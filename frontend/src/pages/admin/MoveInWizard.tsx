import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Gauge,
  ClipboardCheck,
  Key,
  FileText,
  Upload,
  Camera,
  Loader2,
} from "lucide-react";
import {
  startMoveIn,
  getMoveInStatus,
  saveMoveInStep,
  completeMoveIn,
  ocrMeterReading,
  uploadPropertyDocument,
  type WorkflowStep,
} from "@/lib/api";
import { formatHuf } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeterForm {
  villany: string;
  viz: string;
  csatorna: string;
}

interface HandoverForm {
  condition_notes: string;
  condition_rating: string;
}

interface KeyForm {
  key_count: string;
  key_notes: string;
}

interface ContractForm {
  move_in_date: string;
  deposit_amount: string;
}

type StepName = "meters" | "handover" | "keys" | "contract";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_META: {
  name: StepName;
  i18nKey: string;
  descKey: string;
  icon: typeof Gauge;
}[] = [
  { name: "meters", i18nKey: "moveIn.step1", descKey: "moveIn.step1Desc", icon: Gauge },
  { name: "handover", i18nKey: "moveIn.step2", descKey: "moveIn.step2Desc", icon: ClipboardCheck },
  { name: "keys", i18nKey: "moveIn.step3", descKey: "moveIn.step3Desc", icon: Key },
  { name: "contract", i18nKey: "moveIn.step4", descKey: "moveIn.step4Desc", icon: FileText },
];

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Kiv\u00e1l\u00f3" },
  { value: "good", label: "J\u00f3" },
  { value: "average", label: "\u00c1tlagos" },
  { value: "needs_renovation", label: "Fel\u00faj\u00edtand\u00f3" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MoveInWizard = () => {
  const { id } = useParams();
  const propertyId = Number(id);
  const navigate = useNavigate();
  const { t } = useI18n();

  // Global state
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Step forms
  const [meterForm, setMeterForm] = useState<MeterForm>({ villany: "", viz: "", csatorna: "" });
  const [handoverForm, setHandoverForm] = useState<HandoverForm>({ condition_notes: "", condition_rating: "good" });
  const [keyForm, setKeyForm] = useState<KeyForm>({ key_count: "2", key_notes: "" });
  const [contractForm, setContractForm] = useState<ContractForm>({
    move_in_date: new Date().toISOString().split("T")[0],
    deposit_amount: "",
  });

  // OCR
  const [ocrProcessing, setOcrProcessing] = useState<string | null>(null);
  const ocrInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Contract file upload
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const contractInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!propertyId || isNaN(propertyId)) return;

    const init = async () => {
      setLoading(true);
      try {
        await startMoveIn(propertyId);
        const res = await getMoveInStatus(propertyId);
        hydrateFromSteps(res.steps);
      } catch (err: any) {
        // If workflow already started, just fetch status
        try {
          const res = await getMoveInStatus(propertyId);
          hydrateFromSteps(res.steps);
        } catch {
          toast.error(t("common.error"));
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hydrateFromSteps = (steps: WorkflowStep[]) => {
    const done = new Set<number>();

    steps.forEach((ws) => {
      const idx = STEP_META.findIndex((s) => s.name === ws.step);
      if (idx === -1) return;

      if (ws.status === "completed") done.add(idx);

      if (ws.data) {
        try {
          const parsed = typeof ws.data === "string" ? JSON.parse(ws.data) : ws.data;
          switch (ws.step) {
            case "meters":
              setMeterForm({
                villany: parsed.villany?.toString() ?? "",
                viz: parsed.viz?.toString() ?? "",
                csatorna: parsed.csatorna?.toString() ?? "",
              });
              break;
            case "handover":
              setHandoverForm({
                condition_notes: parsed.condition_notes ?? "",
                condition_rating: parsed.condition_rating ?? "good",
              });
              break;
            case "keys":
              setKeyForm({
                key_count: parsed.key_count?.toString() ?? "2",
                key_notes: parsed.key_notes ?? "",
              });
              break;
            case "contract":
              setContractForm({
                move_in_date: parsed.move_in_date ?? new Date().toISOString().split("T")[0],
                deposit_amount: parsed.deposit_amount?.toString() ?? "",
              });
              if (parsed.contract_uploaded) setUploadDone(true);
              break;
          }
        } catch {
          // ignore parse errors
        }
      }
    });

    setCompletedSteps(done);

    // Jump to first incomplete step
    for (let i = 0; i < STEP_META.length; i++) {
      if (!done.has(i)) {
        setActiveStep(i);
        return;
      }
    }
    setActiveStep(STEP_META.length - 1);
  };

  // ---------------------------------------------------------------------------
  // Save step
  // ---------------------------------------------------------------------------

  const getStepData = useCallback(
    (stepIdx: number): Record<string, any> => {
      switch (stepIdx) {
        case 0:
          return {
            villany: meterForm.villany ? Number(meterForm.villany) : null,
            viz: meterForm.viz ? Number(meterForm.viz) : null,
            csatorna: meterForm.csatorna ? Number(meterForm.csatorna) : null,
          };
        case 1:
          return {
            condition_notes: handoverForm.condition_notes,
            condition_rating: handoverForm.condition_rating,
          };
        case 2:
          return {
            key_count: keyForm.key_count ? Number(keyForm.key_count) : null,
            key_notes: keyForm.key_notes,
          };
        case 3:
          return {
            move_in_date: contractForm.move_in_date,
            deposit_amount: contractForm.deposit_amount ? Number(contractForm.deposit_amount) : null,
            contract_uploaded: uploadDone,
          };
        default:
          return {};
      }
    },
    [meterForm, handoverForm, keyForm, contractForm, uploadDone],
  );

  const saveCurrentStep = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const stepName = STEP_META[activeStep].name;
      const data = getStepData(activeStep);
      await saveMoveInStep(propertyId, stepName, data);
      setCompletedSteps((prev) => new Set([...prev, activeStep]));
      return true;
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleNext = async () => {
    const ok = await saveCurrentStep();
    if (ok && activeStep < STEP_META.length - 1) {
      setActiveStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  const handleStepClick = (idx: number) => {
    // Allow navigation to completed steps or the next available step
    if (idx <= activeStep || completedSteps.has(idx) || completedSteps.has(idx - 1) || idx === 0) {
      setActiveStep(idx);
    }
  };

  // ---------------------------------------------------------------------------
  // Complete workflow
  // ---------------------------------------------------------------------------

  const handleComplete = async () => {
    // Save the current (last) step first
    const saved = await saveCurrentStep();
    if (!saved) return;

    setFinishing(true);
    try {
      await completeMoveIn(propertyId, {
        move_in_date: contractForm.move_in_date,
        deposit_amount: contractForm.deposit_amount ? Number(contractForm.deposit_amount) : null,
      });
      toast.success(t("moveIn.completed"));
      navigate(`/admin/properties/${propertyId}`);
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setFinishing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // OCR handler
  // ---------------------------------------------------------------------------

  const handleOcr = async (utilityType: string) => {
    const input = ocrInputRefs.current[utilityType];
    if (!input) return;
    input.click();
  };

  const onOcrFileSelected = async (utilityType: string, file: File) => {
    setOcrProcessing(utilityType);
    try {
      const res = await ocrMeterReading(file);
      if (res.success && res.value !== null) {
        setMeterForm((prev) => ({ ...prev, [utilityType]: String(res.value) }));
        toast.success(t("reading.ocrSuccess", { value: String(res.value) }));
      } else {
        toast.error(t("reading.ocrFailed"));
      }
    } catch {
      toast.error(t("reading.ocrFailed"));
    } finally {
      setOcrProcessing(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Contract upload
  // ---------------------------------------------------------------------------

  const handleContractUpload = async () => {
    if (!contractFile) return;
    setUploading(true);
    try {
      await uploadPropertyDocument(propertyId, contractFile, "szerzodes", "Move-in contract");
      setUploadDone(true);
      toast.success(t("common.success"));
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: step progress indicator
  // ---------------------------------------------------------------------------

  const renderProgressIndicator = () => (
    <div className="flex items-center justify-between w-full mb-8">
      {STEP_META.map((step, idx) => {
        const Icon = step.icon;
        const isActive = idx === activeStep;
        const isCompleted = completedSteps.has(idx);
        const isClickable = idx <= activeStep || isCompleted || completedSteps.has(idx - 1) || idx === 0;

        return (
          <div key={step.name} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => handleStepClick(idx)}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                  ${isCompleted
                    ? "gradient-primary-bg border-transparent text-white"
                    : isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                  }
                  ${isClickable ? "cursor-pointer hover:scale-105" : "cursor-not-allowed opacity-60"}
                `}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </button>
              <span
                className={`text-[11px] mt-1.5 text-center max-w-[80px] leading-tight ${
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {t(step.i18nKey)}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEP_META.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-20px] rounded-full transition-colors ${
                  completedSteps.has(idx) ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: step 1 — Meter Readings
  // ---------------------------------------------------------------------------

  const renderMeterStep = () => {
    const meters: { key: keyof MeterForm; label: string; unit: string }[] = [
      { key: "villany", label: t("common.villany"), unit: "kWh" },
      { key: "viz", label: t("common.viz"), unit: "m\u00b3" },
      { key: "csatorna", label: t("common.csatorna"), unit: "m\u00b3" },
    ];

    return (
      <div className="space-y-4">
        {meters.map((m) => (
          <div key={m.key} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{m.label}</label>
              <span className="text-xs text-muted-foreground">{m.unit}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={t("moveIn.meterValue")}
                value={meterForm[m.key]}
                onChange={(e) => setMeterForm((f) => ({ ...f, [m.key]: e.target.value }))}
                className="flex-1"
              />
              {/* Hidden file input for OCR */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={(el) => { ocrInputRefs.current[m.key] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onOcrFileSelected(m.key, file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={ocrProcessing === m.key}
                onClick={() => handleOcr(m.key)}
                title={t("reading.ocrBtn")}
              >
                {ocrProcessing === m.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: step 2 — Handover
  // ---------------------------------------------------------------------------

  const renderHandoverStep = () => (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <label className="text-sm font-medium block mb-2">{t("moveIn.condition")}</label>
        <Select
          value={handoverForm.condition_rating}
          onValueChange={(v) => setHandoverForm((f) => ({ ...f, condition_rating: v }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card p-4">
        <label className="text-sm font-medium block mb-2">{t("moveIn.conditionNotes")}</label>
        <Textarea
          rows={5}
          placeholder={t("moveIn.conditionNotes")}
          value={handoverForm.condition_notes}
          onChange={(e) => setHandoverForm((f) => ({ ...f, condition_notes: e.target.value }))}
        />
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: step 3 — Key Handover
  // ---------------------------------------------------------------------------

  const renderKeyStep = () => (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <label className="text-sm font-medium block mb-2">{t("moveIn.keyCount")}</label>
        <Input
          type="number"
          min={0}
          value={keyForm.key_count}
          onChange={(e) => setKeyForm((f) => ({ ...f, key_count: e.target.value }))}
        />
      </div>

      <div className="glass-card p-4">
        <label className="text-sm font-medium block mb-2">{t("moveIn.keyNotes")}</label>
        <Textarea
          rows={3}
          placeholder={t("moveIn.keyNotes")}
          value={keyForm.key_notes}
          onChange={(e) => setKeyForm((f) => ({ ...f, key_notes: e.target.value }))}
        />
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: step 4 — Contract + Final
  // ---------------------------------------------------------------------------

  const renderContractStep = () => (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <label className="text-sm font-medium block mb-2">{t("tenant.moveInDate")}</label>
        <Input
          type="date"
          value={contractForm.move_in_date}
          onChange={(e) => setContractForm((f) => ({ ...f, move_in_date: e.target.value }))}
        />
      </div>

      <div className="glass-card p-4">
        <label className="text-sm font-medium block mb-2">{t("moveIn.depositAmount")}</label>
        <Input
          type="number"
          placeholder={formatHuf(0).replace("0", "").trim()}
          value={contractForm.deposit_amount}
          onChange={(e) => setContractForm((f) => ({ ...f, deposit_amount: e.target.value }))}
        />
        {contractForm.deposit_amount && Number(contractForm.deposit_amount) > 0 && (
          <p className="text-xs text-muted-foreground mt-1 format-hu">
            {formatHuf(Number(contractForm.deposit_amount))}
          </p>
        )}
      </div>

      <div className="glass-card p-4">
        <label className="text-sm font-medium block mb-2">{t("moveIn.uploadContract")}</label>

        {uploadDone ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span>{t("common.success")}</span>
          </div>
        ) : (
          <>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              ref={contractInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setContractFile(file);
              }}
            />

            <div
              onClick={() => contractInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              {contractFile ? (
                <p className="text-sm font-medium">{contractFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{t("docs.uploadFile")}</p>
              )}
            </div>

            {contractFile && !uploadDone && (
              <Button
                onClick={handleContractUpload}
                disabled={uploading}
                className="mt-3 w-full gradient-primary-bg border-0"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("docs.upload")}
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: active step content
  // ---------------------------------------------------------------------------

  const renderStepContent = () => {
    const meta = STEP_META[activeStep];

    return (
      <Card className="glass-card border-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <meta.icon className="h-5 w-5 text-primary" />
            {t(meta.i18nKey)}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t(meta.descKey)}</p>
        </CardHeader>
        <CardContent>
          {activeStep === 0 && renderMeterStep()}
          {activeStep === 1 && renderHandoverStep()}
          {activeStep === 2 && renderKeyStep()}
          {activeStep === 3 && renderContractStep()}
        </CardContent>
      </Card>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: bottom navigation
  // ---------------------------------------------------------------------------

  const renderNavigation = () => {
    const isLast = activeStep === STEP_META.length - 1;

    return (
      <div className="flex items-center justify-between pt-4">
        {activeStep > 0 ? (
          <Button variant="outline" onClick={handleBack} disabled={saving}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => navigate(`/admin/properties/${propertyId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Button>
        )}

        {isLast ? (
          <Button
            onClick={handleComplete}
            disabled={finishing || saving}
            className="gradient-primary-bg border-0"
          >
            {finishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t("moveIn.complete")}
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={saving}
            className="gradient-primary-bg border-0"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              <>
                {t("common.next")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate(`/admin/properties/${propertyId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-bold">{t("moveIn.title")}</h1>
      </div>

      {/* Progress indicator */}
      {renderProgressIndicator()}

      {/* Step content */}
      {renderStepContent()}

      {/* Navigation */}
      {renderNavigation()}
    </div>
  );
};

export default MoveInWizard;
