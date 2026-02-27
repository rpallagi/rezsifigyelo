import { useEffect, useState } from "react";
import { Zap, Droplets, Waves, Flame, TrendingUp, TrendingDown, Plus, Camera, Trash2, Loader2, ChevronRight, ArrowLeft, Check } from "lucide-react";
import {
  getPropertyReadings, adminSubmitReading, deletePropertyReadingsByUtility,
  type PropertyReadingsData,
} from "@/lib/api";
import { formatHuf, formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/lib/i18n";
import MeterReadingFormContent from "@/components/MeterReadingFormContent";
import { initialMeterReadingFormState, type MeterReadingFormState } from "@/components/meterReadingFormState";

interface Props {
  propertyId: number;
  propertyName: string;
  tariffGroupId: number;
}

const METER_TYPES = [
  { id: "villany" as const, label: "Villany", Icon: Zap, color: "hsl(45, 93%, 47%)", unit: "kWh" },
  { id: "viz" as const, label: "Víz", Icon: Droplets, color: "hsl(199, 89%, 48%)", unit: "m³" },
  { id: "gaz" as const, label: "Gáz", Icon: Flame, color: "hsl(20, 90%, 52%)", unit: "m³" },
];

const PropertyReadings = ({ propertyId, propertyName, tariffGroupId }: Props) => {
  const { t } = useI18n();
  const [data, setData] = useState<PropertyReadingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingUtility, setDeletingUtility] = useState<string | null>(null);
  const [utilityType, setUtilityType] = useState<"villany" | "viz" | "gaz">("villany");
  const [formState, setFormState] = useState<MeterReadingFormState>(initialMeterReadingFormState());

  const patchForm = (patch: Partial<MeterReadingFormState>) =>
    setFormState((s) => ({ ...s, ...patch }));

  const load = () => {
    setLoading(true);
    getPropertyReadings(propertyId).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const openDialog = () => {
    setFormState(initialMeterReadingFormState());
    setUtilityType("villany");
    setStep(0);
    setDialogOpen(true);
  };

  const selectedMeterType = METER_TYPES.find((m) => m.id === utilityType)!;

  const prevValue = (() => {
    if (!data) return 0;
    const matching = data.readings
      .filter((r) => r.utility_type === utilityType)
      .sort((a, b) => (a.reading_date > b.reading_date ? -1 : 1));
    return matching[0]?.value ?? 0;
  })();

  const currentValue = parseFloat(formState.value) || 0;
  const consumption = currentValue > prevValue ? currentValue - prevValue : 0;

  const handleSubmitReading = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("property_id", String(propertyId));
      fd.append("utility_type", utilityType);
      fd.append("value", formState.value);
      fd.append("reading_date", formState.readingDate);
      if (formState.notes) fd.append("notes", formState.notes);
      if (formState.photo) fd.append("photo", formState.photo);
      await adminSubmitReading(fd);
      setDialogOpen(false);
      load();
    } catch (e: any) {
      alert(e.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUtilityReadings = async (ut: string, label: string) => {
    const ok = window.confirm(
      t("adminReadings.deleteUtilityConfirm").replace("{utility}", label).replace("{property}", propertyName),
    );
    if (!ok) return;
    setDeletingUtility(ut);
    try {
      const res = await deletePropertyReadingsByUtility(propertyId, ut as any);
      alert(t("adminReadings.deleteUtilityDone").replace("{count}", String(res.deleted || 0)));
      load();
    } catch (e: any) {
      alert(e.message || t("common.error"));
    } finally {
      setDeletingUtility(null);
    }
  };

  const utilityIcon = (type: string) => {
    if (type === "villany") return <Zap className="h-4 w-4" style={{ color: "hsl(45, 93%, 47%)" }} />;
    if (type === "viz") return <Droplets className="h-4 w-4" style={{ color: "hsl(199, 89%, 48%)" }} />;
    if (type === "gaz") return <Flame className="h-4 w-4" style={{ color: "hsl(20, 90%, 52%)" }} />;
    return <Waves className="h-4 w-4" style={{ color: "hsl(280, 60%, 55%)" }} />;
  };

  const utilityColor = (type: string) => {
    if (type === "villany") return "hsl(45, 93%, 47%)";
    if (type === "viz") return "hsl(199, 89%, 48%)";
    if (type === "gaz") return "hsl(20, 90%, 52%)";
    return "hsl(280, 60%, 55%)";
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );

  if (!data) return null;

  const { readings, trends, sparklines } = data;

  const cardDefs = [
    { type: "villany", label: t("common.villany"), icon: Zap, color: "hsl(45, 93%, 47%)", trend: trends.villany, spark: sparklines.villany },
    { type: "viz", label: t("common.viz"), icon: Droplets, color: "hsl(199, 89%, 48%)", trend: trends.viz, spark: sparklines.viz },
    { type: "gaz", label: t("common.gaz"), icon: Flame, color: "hsl(20, 90%, 52%)", trend: trends.gaz, spark: sparklines.gaz },
  ];

  const trendCards = cardDefs.filter((c) =>
    readings.some((r) => r.utility_type === c.type) ||
    (Array.isArray(c.spark) && c.spark.length > 0) ||
    Boolean(c.trend)
  );

  return (
    <div className="space-y-5">
      {/* Trend cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {trendCards.map((card) => {
          const sparkData = (card.spark || []).map((v, i) => ({ v, i }));
          const changePct = card.trend?.change_pct ?? 0;
          const isUp = changePct > 0;
          return (
            <div key={card.type} className="glass-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <card.icon className="h-5 w-5" style={{ color: card.color }} />
                    <span className="font-display font-semibold text-sm">{card.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {card.trend && (
                      <Badge variant="outline" className={`text-xs ${isUp ? "text-red-500 border-red-200 bg-red-50 dark:bg-red-950" : "text-green-500 border-green-200 bg-green-50 dark:bg-green-950"}`}>
                        {isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {Math.abs(changePct).toFixed(1)}%
                      </Badge>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteUtilityReadings(card.type, card.label)} disabled={deletingUtility === card.type}>
                      {deletingUtility === card.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                {card.trend && (
                  <div className="flex items-end gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("adminReadings.consumption")}</p>
                      <p className="font-display font-bold text-xl format-hu">{formatNumber(card.trend.current, 1)} {card.type === "villany" ? "kWh" : "m³"}</p>
                    </div>
                  </div>
                )}
              </div>
              {sparkData.length > 1 && (
                <div className="h-16 px-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData}>
                      <defs>
                        <linearGradient id={`rd-spark-${card.type}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={card.color} strokeWidth={2} fill={`url(#rd-spark-${card.type})`} dot={false} animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={openDialog} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" />{t("adminReadings.newReading")}
        </Button>
      </div>

      {/* Readings list */}
      <div className="space-y-2">
        {readings.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground text-sm">{t("adminReadings.noResults")}</p>
          </div>
        ) : readings.map((r) => (
          <div key={r.id} className="glass-card p-4 flex items-center gap-3" style={{ borderLeft: `3px solid ${utilityColor(r.utility_type)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${utilityColor(r.utility_type)}15` }}>
              {utilityIcon(r.utility_type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {r.utility_type === "villany" ? t("common.villany") : r.utility_type === "viz" ? t("common.viz") : r.utility_type === "gaz" ? t("common.gaz") : t("common.csatorna")}
                </Badge>
                {r.photo_filename && <Camera className="h-3 w-3 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(r.reading_date)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-display font-bold text-sm format-hu">{formatNumber(r.value, 1)} {r.utility_type === "villany" ? "kWh" : "m³"}</p>
              {r.consumption != null && <p className="text-xs text-muted-foreground">{t("adminReadings.consumption")}: {formatNumber(r.consumption, 1)}</p>}
              {r.cost_huf != null && <p className="text-xs font-medium format-hu">{formatHuf(r.cost_huf)}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Step wizard dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); } }}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("adminReadings.newReading")}</DialogTitle>
            <DialogDescription>{propertyName}</DialogDescription>
          </DialogHeader>

          {/* Progress bar */}
          <div className="flex gap-2 mb-2">
            {[0, 1, 2].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          {/* Step 0: Select meter type */}
          {step === 0 && (
            <div className="space-y-3">
              {METER_TYPES.map((type) => {
                const last = readings.filter((r) => r.utility_type === type.id).sort((a, b) => b.reading_date.localeCompare(a.reading_date))[0];
                return (
                  <button key={type.id}
                    onClick={() => { setUtilityType(type.id); setFormState(initialMeterReadingFormState()); setStep(1); }}
                    className="w-full glass-card-hover p-4 flex items-center gap-4 text-left"
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${type.color}15` }}>
                      <type.Icon className="h-6 w-6" style={{ color: type.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold">{type.label}</p>
                      {last && <p className="text-xs text-muted-foreground mt-0.5">{t("reading.previous")}: {formatNumber(last.value)} {type.unit} ({last.reading_date})</p>}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 1: Enter value */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${selectedMeterType.color}15` }}>
                  <selectedMeterType.Icon className="h-5 w-5" style={{ color: selectedMeterType.color }} />
                </div>
                <div>
                  <p className="font-display font-semibold">{selectedMeterType.label} {t("reading.meterReading")}</p>
                  <p className="text-xs text-muted-foreground">{t("reading.previous")}: {formatNumber(prevValue)} {selectedMeterType.unit}</p>
                </div>
              </div>

              <MeterReadingFormContent
                state={formState}
                onChange={patchForm}
                utilityType={utilityType}
                prevValue={prevValue}
                role="admin"
              />

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />{t("common.back")}
                </Button>
                <Button className="flex-1 gradient-primary-bg border-0" disabled={currentValue <= 0} onClick={() => setStep(2)}>
                  {t("common.next")} <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="glass-card p-5">
                <h3 className="font-display font-bold mb-4">{t("reading.summary")}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">{t("reading.meterType")}</span>
                    <span className="font-medium flex items-center gap-2">
                      <selectedMeterType.Icon className="h-4 w-4" style={{ color: selectedMeterType.color }} />
                      {selectedMeterType.label}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">{t("reading.newReading")}</span>
                    <span className="font-mono font-semibold">{formatNumber(currentValue)} {selectedMeterType.unit}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">{t("reading.consumption")}</span>
                    <span className="font-mono font-semibold">{formatNumber(consumption)} {selectedMeterType.unit}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">{t("reading.date")}</span>
                    <span className="font-medium">{formState.readingDate}</span>
                  </div>
                  {formState.photo && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">{t("reading.photo")}</span>
                      <span className="text-green-600 font-medium">{t("reading.photoAttached")}</span>
                    </div>
                  )}
                </div>
              </div>

              {formState.photoPreview && (
                <img src={formState.photoPreview} alt="" className="w-full h-36 object-cover rounded-xl" />
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />{t("common.back")}
                </Button>
                <Button className="flex-1 gradient-primary-bg border-0 font-semibold" onClick={handleSubmitReading} disabled={saving}>
                  {saving ? t("common.saving") : t("adminReadings.submitReading")} {!saving && <Check className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyReadings;
