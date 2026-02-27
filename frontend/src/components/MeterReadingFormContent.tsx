/**
 * Shared meter reading form content — used in both tenant (MeterReading.tsx)
 * and admin (PropertyReadings.tsx) flows so the UX is identical.
 */
import { useRef } from "react";
import { Camera, ImagePlus, ScanLine, Check, X, CalendarDays, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ocrMeterPhoto } from "@/lib/api";
import { formatHuf, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

import type { MeterReadingFormState } from "./meterReadingFormState";

interface Props {
  state: MeterReadingFormState;
  onChange: (patch: Partial<MeterReadingFormState>) => void;
  utilityType: "villany" | "viz" | "gaz" | "csatorna";
  prevValue?: number;
  rate?: number;
  csatornaRate?: number;
  role?: "admin" | "tenant";
}

const MeterReadingFormContent = ({
  state, onChange, utilityType, prevValue = 0, rate = 0, csatornaRate = 0, role = "tenant",
}: Props) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unit = utilityType === "villany" ? "kWh" : "m³";
  const currentValue = parseFloat(state.value) || 0;
  const consumption = currentValue > prevValue ? currentValue - prevValue : 0;
  const estimatedCost = consumption * rate;
  const csatornaCost = utilityType === "viz" ? consumption * csatornaRate : 0;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () =>
      onChange({ photo: file, photoPreview: reader.result as string, ocrResult: null });
    reader.readAsDataURL(file);
  };

  const handleOcr = async () => {
    if (!state.photo) return;
    console.log("[OCR] Starting OCR for", utilityType, "photo:", state.photo.name, state.photo.size, "bytes");
    onChange({ ocrLoading: true, ocrResult: null });
    try {
      const result = await ocrMeterPhoto(state.photo, role, utilityType);
      console.log("[OCR] Result:", result);
      onChange({
        ocrLoading: false,
        ocrResult: { value: result.value, confidence: result.confidence },
        ...(result.value != null ? { value: String(result.value) } : {}),
      });
    } catch (err) {
      console.error("[OCR] Error:", err);
      onChange({ ocrLoading: false, ocrResult: { value: null, confidence: "low" } });
    }
  };

  const removePhoto = () =>
    onChange({ photo: null, photoPreview: null, ocrResult: null });

  return (
    <div className="space-y-4">
      {/* Value input */}
      <div>
        <label className="text-sm text-muted-foreground block mb-1">
          {t('adminReadings.meterValue')} * {prevValue > 0 && (
            <span className="text-xs opacity-70">
              ({t('reading.previous')}: {formatNumber(prevValue)} {unit})
            </span>
          )}
        </label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={state.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={`pl. ${formatNumber(prevValue + 100)}`}
          className="text-2xl font-display font-bold h-14 text-center border-2 focus:border-primary"
          autoFocus
        />
      </div>

      {/* Consumption preview */}
      {currentValue > 0 && consumption > 0 && (
        <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('reading.consumption')}</span>
            <span className="font-mono font-semibold">{formatNumber(consumption, 2)} {unit}</span>
          </div>
          {rate > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('reading.estimatedCost')}</span>
              <span className="font-display font-bold text-primary format-hu">{formatHuf(estimatedCost)}</span>
            </div>
          )}
          {csatornaCost > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ {t('common.csatorna')}</span>
                <span className="font-semibold text-sm format-hu">{formatHuf(csatornaCost)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-1">
                <span className="font-medium">{t('reading.total')}</span>
                <span className="font-display font-bold format-hu">{formatHuf(estimatedCost + csatornaCost)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Photo + OCR */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t('reading.photo')}</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
        />

        {!state.photo ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.setAttribute("capture", "environment");
                fileInputRef.current?.click();
              }}
              className="flex-1 h-16 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
            >
              <Camera className="h-6 w-6 text-primary" />
              <span className="text-xs font-medium text-primary">{t('reading.takePhoto')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.removeAttribute("capture");
                fileInputRef.current?.click();
              }}
              className="flex-1 h-16 rounded-xl border-2 border-dashed border-border hover:bg-accent/50 transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
            >
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{t('reading.gallery')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Full photo preview */}
            {state.photoPreview && (
              <div className={`relative rounded-xl overflow-hidden border-2 transition-colors ${state.ocrResult?.value != null ? "border-green-500" : "border-border"}`}>
                <img src={state.photoPreview} alt={t('reading.photo')} className="w-full object-contain max-h-52" />
                {state.ocrLoading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                    <div className="bg-white/90 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium">
                      <ScanLine className="h-4 w-4 animate-pulse text-primary" />
                      {t('reading.ocrProcessing')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Zoomed digit strip after OCR success */}
            {state.ocrResult?.value != null && state.photoPreview && (
              <div className="rounded-xl overflow-hidden border-2 border-green-500 relative" style={{ height: 64 }}>
                <img
                  src={state.photoPreview}
                  alt="digits"
                  className="absolute w-full h-full"
                  style={{ objectFit: "cover", objectPosition: "center 50%", transform: "scale(2.8)", transformOrigin: "center 50%" }}
                />
                <div className="absolute inset-0 ring-inset ring-2 ring-green-500/60 rounded-xl pointer-events-none" />
                <div className="absolute bottom-1.5 right-2 bg-green-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow flex items-center gap-1">
                  <Check className="h-3 w-3" /> {state.ocrResult.value}
                </div>
              </div>
            )}

            {/* File row */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> {state.photo.name}
              </span>
              <button type="button" onClick={removePhoto} className="text-xs text-destructive hover:underline">
                {t('reading.removePhoto')}
              </button>
            </div>

            {/* OCR button */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
              onClick={handleOcr}
              disabled={state.ocrLoading}
            >
              <ScanLine className="h-4 w-4" />
              {state.ocrLoading ? t('reading.ocrProcessing') : t('reading.ocrBtn')}
            </Button>

            {/* OCR result banner */}
            {state.ocrResult && (
              <div className={`rounded-xl p-3 flex items-center gap-3 text-sm ${state.ocrResult.value != null ? "bg-green-500/10 border border-green-500/30" : "bg-destructive/10 border border-destructive/30"}`}>
                {state.ocrResult.value != null ? (
                  <>
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="flex-1 font-semibold">
                      {t('reading.ocrSuccess').replace('{value}', String(state.ocrResult.value))}
                    </span>
                    <button type="button" onClick={() => onChange({ ocrResult: null })}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span>{t('reading.ocrFailed')}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date */}
      <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">{t('reading.date')}</label>
          <Input
            type="date"
            value={state.readingDate}
            onChange={(e) => onChange({ readingDate: e.target.value })}
            className="h-8 border-0 p-0 focus-visible:ring-0 bg-transparent"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">{t('reading.notes')}</label>
          <Input
            value={state.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={t('reading.notesPlaceholder')}
            className="h-8 border-0 p-0 focus-visible:ring-0 bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};

export default MeterReadingFormContent;
