import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, Gauge, ClipboardCheck, Key, Wallet,
} from "lucide-react";
import {
  startMoveOut, getMoveOutStatus, saveMoveOutStep, completeMoveOut,
  type WorkflowStep,
} from "@/lib/api";
import { formatHuf } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/* ---------- step metadata ---------- */

const STEPS = [
  { key: "meter_readings", icon: Gauge,          labelKey: "moveOut.step1", descKey: "moveOut.step1Desc" },
  { key: "condition",      icon: ClipboardCheck,  labelKey: "moveOut.step2", descKey: "moveOut.step2Desc" },
  { key: "deposit",        icon: Wallet,          labelKey: "moveOut.step3", descKey: "moveOut.step3Desc" },
  { key: "key_return",     icon: Key,             labelKey: "moveOut.step4", descKey: "moveOut.step4Desc" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

/* ---------- helpers ---------- */

/** Parse saved JSON from a WorkflowStep's `data` column. */
const parseStepData = (steps: WorkflowStep[], stepName: string): Record<string, any> | null => {
  const found = steps.find((s) => s.step === stepName);
  if (!found?.data) return null;
  try {
    return typeof found.data === "string" ? JSON.parse(found.data) : found.data;
  } catch {
    return null;
  }
};

/* ---------- component ---------- */

const MoveOutWizard = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const propertyId = Number(id);
  const navigate = useNavigate();

  /* wizard state */
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  /* step 1 - meter readings */
  const [villany, setVillany] = useState("");
  const [viz, setViz] = useState("");
  const [csatorna, setCsatorna] = useState("");

  /* move-in comparison values (populated from status/move-in data) */
  const [moveInVillany, setMoveInVillany] = useState<number | null>(null);
  const [moveInViz, setMoveInViz] = useState<number | null>(null);
  const [moveInCsatorna, setMoveInCsatorna] = useState<number | null>(null);

  /* step 2 - condition */
  const [conditionNotes, setConditionNotes] = useState("");
  const [conditionRating, setConditionRating] = useState("good");
  const [moveInCondition, setMoveInCondition] = useState<string | null>(null);
  const [moveInConditionRating, setMoveInConditionRating] = useState<string | null>(null);

  /* step 3 - deposit */
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [deductions, setDeductions] = useState("");
  const [deductionNotes, setDeductionNotes] = useState("");

  /* step 4 - key return */
  const [keysReturned, setKeysReturned] = useState("");
  const [expectedKeys, setExpectedKeys] = useState<number | null>(null);

  /* ---------- initialise ---------- */

  useEffect(() => {
    if (!propertyId) return;

    const init = async () => {
      setLoading(true);
      try {
        await startMoveOut(propertyId);
      } catch {
        /* already started - ignore */
      }
      try {
        const res = await getMoveOutStatus(propertyId);
        setSteps(res.steps);
        hydrateFromSteps(res.steps);
      } catch (err: any) {
        toast.error(err.message || t("common.error"));
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [propertyId]);

  /** Rehydrate local form state from previously saved workflow steps. */
  const hydrateFromSteps = (wfSteps: WorkflowStep[]) => {
    /* move-in data (used for comparison) */
    const moveInMeters = parseStepData(wfSteps, "move_in_meter_readings");
    if (moveInMeters) {
      setMoveInVillany(moveInMeters.villany ?? null);
      setMoveInViz(moveInMeters.viz ?? null);
      setMoveInCsatorna(moveInMeters.csatorna ?? null);
    }

    const moveInCond = parseStepData(wfSteps, "move_in_condition");
    if (moveInCond) {
      setMoveInCondition(moveInCond.notes ?? null);
      setMoveInConditionRating(moveInCond.rating ?? null);
    }

    const moveInKeys = parseStepData(wfSteps, "move_in_key_return");
    if (moveInKeys) {
      setExpectedKeys(moveInKeys.key_count ?? moveInKeys.keys ?? null);
    }

    const moveInDeposit = parseStepData(wfSteps, "move_in_deposit");
    if (moveInDeposit) {
      setDepositAmount(moveInDeposit.deposit_amount ?? moveInDeposit.amount ?? 0);
    }

    /* previously-saved move-out step data */
    const meters = parseStepData(wfSteps, "meter_readings");
    if (meters) {
      setVillany(meters.villany != null ? String(meters.villany) : "");
      setViz(meters.viz != null ? String(meters.viz) : "");
      setCsatorna(meters.csatorna != null ? String(meters.csatorna) : "");
    }

    const cond = parseStepData(wfSteps, "condition");
    if (cond) {
      setConditionNotes(cond.notes ?? "");
      setConditionRating(cond.rating ?? "good");
    }

    const dep = parseStepData(wfSteps, "deposit");
    if (dep) {
      setDeductions(dep.deductions != null ? String(dep.deductions) : "");
      setDeductionNotes(dep.deduction_notes ?? "");
      if (dep.deposit_amount != null) setDepositAmount(dep.deposit_amount);
    }

    const kr = parseStepData(wfSteps, "key_return");
    if (kr) {
      setKeysReturned(kr.keys_returned != null ? String(kr.keys_returned) : "");
    }
  };

  /* ---------- step save ---------- */

  const buildStepPayload = (stepKey: StepKey) => {
    switch (stepKey) {
      case "meter_readings":
        return {
          villany: villany ? Number(villany) : null,
          viz: viz ? Number(viz) : null,
          csatorna: csatorna ? Number(csatorna) : null,
        };
      case "condition":
        return { notes: conditionNotes, rating: conditionRating };
      case "deposit":
        return {
          deposit_amount: depositAmount,
          deductions: deductions ? Number(deductions) : 0,
          deduction_notes: deductionNotes,
        };
      case "key_return":
        return { keys_returned: keysReturned ? Number(keysReturned) : 0 };
      default:
        return {};
    }
  };

  const saveCurrentStep = async () => {
    const stepKey = STEPS[currentStep].key;
    setSaving(true);
    try {
      await saveMoveOutStep(propertyId, stepKey, buildStepPayload(stepKey));
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- navigation ---------- */

  const goNext = async () => {
    await saveCurrentStep();
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  /* ---------- complete ---------- */

  const handleComplete = async () => {
    setCompleting(true);
    try {
      /* Save last step first */
      await saveMoveOutStep(propertyId, "key_return", buildStepPayload("key_return"));

      const allData = {
        meter_readings: buildStepPayload("meter_readings"),
        condition: buildStepPayload("condition"),
        deposit: buildStepPayload("deposit"),
        key_return: buildStepPayload("key_return"),
      };
      await completeMoveOut(propertyId, allData);
      toast.success(t("moveOut.completed"));
      navigate(`/admin/properties/${propertyId}`);
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setCompleting(false);
    }
  };

  /* ---------- computed ---------- */

  const consumption = (current: string, moveIn: number | null) => {
    if (moveIn == null || !current) return null;
    const diff = Number(current) - moveIn;
    return isNaN(diff) ? null : diff;
  };

  const deductionNum = deductions ? Number(deductions) : 0;
  const returnAmount = depositAmount - deductionNum;

  /* ---------- render helpers ---------- */

  const ratingLabel = (r: string | null) => {
    const map: Record<string, string> = {
      excellent: "Kiváló",
      good: "Jó",
      fair: "Megfelelő",
      poor: "Gyenge",
      bad: "Rossz",
    };
    return map[r || ""] || r || "—";
  };

  /* ---------- loading skeleton ---------- */

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  /* ---------- stepper ---------- */

  const renderStepper = () => (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, idx) => {
        const StepIcon = step.icon;
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* circle */}
            <button
              type="button"
              onClick={() => idx < currentStep && setCurrentStep(idx)}
              className={`
                relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                ${isCompleted
                  ? "gradient-primary-bg border-transparent text-white cursor-pointer"
                  : isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
                }
              `}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
            </button>

            {/* connector */}
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded transition-colors ${
                  idx < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  /* ---------- step 1: meter readings ---------- */

  const renderStep1 = () => (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          {t("moveOut.step1")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("moveOut.step1Desc")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Villany */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">Villany (kWh)</label>
          <Input
            type="number"
            placeholder={t("moveOut.finalReading")}
            value={villany}
            onChange={(e) => setVillany(e.target.value)}
          />
          {moveInVillany != null && (
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span>{t("moveOut.moveInValue")}: <strong>{moveInVillany}</strong></span>
              {consumption(villany, moveInVillany) != null && (
                <span className="text-primary font-medium">
                  {t("moveOut.consumption")}: {consumption(villany, moveInVillany)} kWh
                </span>
              )}
            </div>
          )}
        </div>

        {/* Viz */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">Viz (m³)</label>
          <Input
            type="number"
            placeholder={t("moveOut.finalReading")}
            value={viz}
            onChange={(e) => setViz(e.target.value)}
          />
          {moveInViz != null && (
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span>{t("moveOut.moveInValue")}: <strong>{moveInViz}</strong></span>
              {consumption(viz, moveInViz) != null && (
                <span className="text-primary font-medium">
                  {t("moveOut.consumption")}: {consumption(viz, moveInViz)} m³
                </span>
              )}
            </div>
          )}
        </div>

        {/* Csatorna */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">Csatorna (m³)</label>
          <Input
            type="number"
            placeholder={t("moveOut.finalReading")}
            value={csatorna}
            onChange={(e) => setCsatorna(e.target.value)}
          />
          {moveInCsatorna != null && (
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span>{t("moveOut.moveInValue")}: <strong>{moveInCsatorna}</strong></span>
              {consumption(csatorna, moveInCsatorna) != null && (
                <span className="text-primary font-medium">
                  {t("moveOut.consumption")}: {consumption(csatorna, moveInCsatorna)} m³
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  /* ---------- step 2: condition ---------- */

  const renderStep2 = () => (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          {t("moveOut.step2")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("moveOut.step2Desc")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Move-in comparison */}
        {(moveInCondition || moveInConditionRating) && (
          <div className="glass-card p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("moveOut.conditionComparison")}
            </p>
            {moveInConditionRating && (
              <p className="text-sm">
                {t("moveIn.condition")}: <strong>{ratingLabel(moveInConditionRating)}</strong>
              </p>
            )}
            {moveInCondition && (
              <p className="text-sm text-muted-foreground">{moveInCondition}</p>
            )}
          </div>
        )}

        {/* Current condition rating */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">{t("moveIn.condition")}</label>
          <Select value={conditionRating} onValueChange={setConditionRating}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">Kiváló</SelectItem>
              <SelectItem value="good">Jó</SelectItem>
              <SelectItem value="fair">Megfelelő</SelectItem>
              <SelectItem value="poor">Gyenge</SelectItem>
              <SelectItem value="bad">Rossz</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Condition notes */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">{t("moveIn.conditionNotes")}</label>
          <Textarea
            rows={4}
            placeholder={t("moveIn.conditionNotes")}
            value={conditionNotes}
            onChange={(e) => setConditionNotes(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );

  /* ---------- step 3: deposit settlement ---------- */

  const renderStep3 = () => (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          {t("moveOut.step3")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("moveOut.step3Desc")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Original deposit */}
        <div className="glass-card p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("moveIn.depositAmount")}</span>
          <span className="font-display font-bold format-hu">{formatHuf(depositAmount)}</span>
        </div>

        {/* Deductions */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">{t("moveOut.depositDeductions")} (Ft)</label>
          <Input
            type="number"
            min={0}
            max={depositAmount}
            placeholder="0"
            value={deductions}
            onChange={(e) => setDeductions(e.target.value)}
          />
        </div>

        {/* Deduction notes */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">{t("moveOut.depositNotes")}</label>
          <Textarea
            rows={3}
            placeholder={t("moveOut.depositNotes")}
            value={deductionNotes}
            onChange={(e) => setDeductionNotes(e.target.value)}
          />
        </div>

        {/* Calculated return */}
        <div className="glass-card p-4 flex items-center justify-between">
          <span className="text-sm font-medium">{t("moveOut.returnAmount")}</span>
          <span
            className={`font-display font-bold text-lg format-hu ${
              returnAmount >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
            }`}
          >
            {formatHuf(Math.max(returnAmount, 0))}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  /* ---------- step 4: key return ---------- */

  const renderStep4 = () => (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          {t("moveOut.step4")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("moveOut.step4Desc")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Expected keys */}
        {expectedKeys != null && (
          <div className="glass-card p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("moveIn.keyCount")}</span>
            <span className="font-display font-bold">{expectedKeys} db</span>
          </div>
        )}

        {/* Keys returned */}
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground block">{t("moveOut.keyReturn")}</label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={keysReturned}
            onChange={(e) => setKeysReturned(e.target.value)}
          />
          {expectedKeys != null && keysReturned && Number(keysReturned) !== expectedKeys && (
            <p className="text-xs text-destructive">
              Eltérés: {Number(keysReturned) - expectedKeys} db
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  /* ---------- step dispatch ---------- */

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStep1();
      case 1: return renderStep2();
      case 2: return renderStep3();
      case 3: return renderStep4();
      default: return null;
    }
  };

  /* ---------- main render ---------- */

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back + title */}
      <div className="animate-in">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/admin/properties/${propertyId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("propDetail.backToList")}
        </Button>
        <h1 className="font-display text-2xl font-bold">{t("moveOut.title")}</h1>
      </div>

      {/* Stepper */}
      <div className="animate-in-delay-1">
        {renderStepper()}
      </div>

      {/* Step label */}
      <div className="text-center animate-in-delay-1">
        <p className="text-sm text-muted-foreground">
          {currentStep + 1} / {STEPS.length} — {t(STEPS[currentStep].descKey)}
        </p>
      </div>

      {/* Current step content */}
      <div className="animate-in-delay-2">
        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 animate-in-delay-2">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStep === 0 || saving}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back") || "Vissza"}
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button
            className="gradient-primary-bg border-0"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? (t("common.saving") || "Mentés...") : (t("common.next") || "Tovább")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            className="gradient-primary-bg border-0"
            onClick={handleComplete}
            disabled={completing}
          >
            {completing ? (t("common.saving") || "Mentés...") : t("moveOut.complete")}
            <Check className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default MoveOutWizard;
