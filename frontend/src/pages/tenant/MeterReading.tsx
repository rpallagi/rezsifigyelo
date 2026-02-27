import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Droplets, Flame, ChevronRight, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTenantDashboard, submitReading, type TenantDashboardData } from "@/lib/api";
import { formatHuf, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import MeterReadingFormContent, {
  initialMeterReadingFormState, type MeterReadingFormState,
} from "@/components/MeterReadingFormContent";

const MeterReading = () => {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<{ id: 'villany' | 'viz' | 'gaz'; label: string; Icon: typeof Zap; color: string; unit: string; desc: string } | null>(null);
  const [formState, setFormState] = useState<MeterReadingFormState>(initialMeterReadingFormState());
  const patchForm = (patch: Partial<MeterReadingFormState>) => setFormState((s) => ({ ...s, ...patch }));
  const [submitted, setSubmitted] = useState(false);
  const [dashData, setDashData] = useState<TenantDashboardData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const meterTypes = [
    { id: 'villany' as const, label: t('common.villany'), Icon: Zap, color: 'hsl(45, 93%, 47%)', unit: 'kWh', desc: t('reading.villanyDesc') },
    { id: 'viz' as const, label: t('common.viz'), Icon: Droplets, color: 'hsl(199, 89%, 48%)', unit: 'm\u00B3', desc: t('reading.vizDesc') },
    ...(dashData?.has_gas ? [{ id: 'gaz' as const, label: t('common.gaz'), Icon: Flame, color: 'hsl(15, 90%, 55%)', unit: 'm\u00B3', desc: t('reading.gazDesc') }] : []),
  ];

  useEffect(() => {
    getTenantDashboard().then(setDashData).catch(() => navigate("/tenant/login"));
  }, []);

  const prevValue = selectedType && dashData
    ? (selectedType.id === 'villany' ? dashData.last_villany?.value
      : selectedType.id === 'viz' ? dashData.last_viz?.value
      : dashData.last_gaz?.value) || 0
    : 0;

  const rate = selectedType && dashData?.tariffs
    ? (selectedType.id === 'villany'
        ? dashData.tariffs.villany?.rate_huf
        : selectedType.id === 'viz'
        ? dashData.tariffs.viz?.rate_huf
        : dashData.tariffs.gaz?.rate_huf) || 0
    : 0;

  const csatornaRate = dashData?.tariffs?.csatorna?.rate_huf || 0;
  const currentValue = parseFloat(formState.value) || 0;
  const consumption = currentValue > prevValue ? currentValue - prevValue : 0;
  const estimatedCost = consumption * rate;
  const csatornaCost = selectedType?.id === 'viz' ? consumption * csatornaRate : 0;

  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('utility_type', selectedType.id);
      fd.append('value', String(currentValue));
      fd.append('reading_date', formState.readingDate);
      if (formState.notes) fd.append('notes', formState.notes);
      if (formState.photo) fd.append('photo', formState.photo);

      await submitReading(fd);
      setSubmitted(true);
      setTimeout(() => navigate("/tenant"), 2000);
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-5 animate-in">
          <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="h-7 w-7 text-success" strokeWidth={3} />
          </div>
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 animate-in-delay-1">{t('reading.success')}</h2>
        <p className="text-muted-foreground text-sm animate-in-delay-2">{t('reading.successDesc')}</p>
        <p className="text-muted-foreground text-xs mt-1 animate-in-delay-2">{t('reading.redirecting')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-2 mb-6 animate-in">
        <h1 className="font-display text-2xl font-bold">{t('reading.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {step === 0 && t('reading.step0')}
          {step === 1 && t('reading.step1')}
          {step === 2 && t('reading.step2')}
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* Step 0: Select type */}
      {step === 0 && (
        <div className="space-y-3 animate-in">
          {meterTypes.map((type) => {
            const lastValue = type.id === 'villany'
              ? dashData?.last_villany?.value
              : type.id === 'viz'
              ? dashData?.last_viz?.value
              : dashData?.last_gaz?.value;
            const lastDate = type.id === 'villany'
              ? dashData?.last_villany?.reading_date
              : type.id === 'viz'
              ? dashData?.last_viz?.reading_date
              : dashData?.last_gaz?.reading_date;

            return (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type); setStep(1); }}
                className="glass-card-hover w-full p-5 flex items-center gap-4 text-left"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${type.color}15` }}
                >
                  <type.Icon className="h-7 w-7" style={{ color: type.color }} />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-base">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                  {lastValue != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('reading.previous')}: <span className="font-medium text-foreground">{formatNumber(lastValue)} {type.unit}</span>
                      {lastDate && <span className="ml-1 opacity-60">({lastDate})</span>}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Step 1: Enter value */}
      {step === 1 && selectedType && (
        <div className="animate-in space-y-5">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${selectedType.color}15` }}>
                <selectedType.Icon className="h-5 w-5" style={{ color: selectedType.color }} />
              </div>
              <div>
                <p className="font-display font-semibold">{selectedType.label} {t('reading.meterReading')}</p>
                <p className="text-xs text-muted-foreground">{t('reading.previous')}: {formatNumber(prevValue)} {selectedType.unit}</p>
              </div>
            </div>
            {/* Shared form content — same as admin */}
            <MeterReadingFormContent
              state={formState}
              onChange={patchForm}
              utilityType={selectedType.id}
              prevValue={prevValue}
              rate={rate}
              csatornaRate={csatornaRate}
              role="tenant"
            />

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12" onClick={() => { setStep(0); setFormState(initialMeterReadingFormState()); }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
            </Button>
            <Button className="flex-1 h-12 gradient-primary-bg border-0 font-semibold" disabled={currentValue <= prevValue} onClick={() => setStep(2)}>
              {t('common.next')} <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && selectedType && (
        <div className="animate-in space-y-5">
          <div className="glass-card p-6">
            <h3 className="font-display font-bold text-lg mb-4">{t('reading.summary')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('reading.meterType')}</span>
                <span className="font-medium flex items-center gap-2">
                  <selectedType.Icon className="h-4 w-4" style={{ color: selectedType.color }} />
                  {selectedType.label}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('reading.newReading')}</span>
                <span className="font-mono font-semibold">{formatNumber(currentValue)} {selectedType.unit}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('reading.consumption')}</span>
                <span className="font-mono font-semibold">{formatNumber(consumption)} {selectedType.unit}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('reading.date')}</span>
                <span className="font-medium">{formState.readingDate}</span>
              </div>
              {formState.photo && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t('reading.photo')}</span>
                  <span className="text-success font-medium">{t('reading.photoAttached')}</span>
                </div>
              )}
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between py-1">
                <span className="font-medium">{t('reading.estimatedCost')}</span>
                <span className="font-display font-bold text-lg text-primary format-hu">{formatHuf(estimatedCost + csatornaCost)}</span>
              </div>
            </div>
          </div>

          {/* Photo preview in confirmation */}
          {formState.photoPreview && (
            <div className="glass-card p-3 animate-in">
              <img src={formState.photoPreview} alt={t('reading.photo')} className="w-full h-40 object-cover rounded-lg" />
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
            </Button>
            <Button className="flex-1 h-12 gradient-primary-bg border-0 font-semibold" onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('reading.submitting') : t('reading.submit')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeterReading;
