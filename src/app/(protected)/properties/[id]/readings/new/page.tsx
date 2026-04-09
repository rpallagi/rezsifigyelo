"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";
import {
  Zap,
  Droplets,
  Flame,
  Waves,
  ChevronRight,
  ArrowLeft,
  Camera,
  ImageIcon,
  Check,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type UtilityType = "villany" | "viz" | "gaz" | "csatorna";

const utilityMeta: Record<
  UtilityType,
  {
    label: string;
    unit: string;
    icon: typeof Zap;
    color: string;
    bgColor: string;
    borderColor: string;
    iconBg: string;
  }
> = {
  villany: {
    label: "Villany",
    unit: "kWh",
    icon: Zap,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    iconBg: "bg-amber-100",
  },
  viz: {
    label: "Víz",
    unit: "m³",
    icon: Droplets,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    iconBg: "bg-blue-100",
  },
  gaz: {
    label: "Gáz",
    unit: "m³",
    icon: Flame,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    iconBg: "bg-orange-100",
  },
  csatorna: {
    label: "Csatorna",
    unit: "m³",
    icon: Waves,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    iconBg: "bg-purple-100",
  },
};

const METER_UTILITY_TYPES = new Set<string>(Object.keys(utilityMeta));

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewReadingPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  /* ---- wizard state ---- */
  const [step, setStep] = useState(0);
  const [utilityType, setUtilityType] = useState<UtilityType | null>(null);
  const [value, setValue] = useState("");
  const [readingDate, setReadingDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  /* ---- data ---- */
  const { data: property, isLoading } = api.property.get.useQuery({
    id: propertyId,
  });

  const createReading = api.reading.record.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  /* ---- derived ---- */
  const meters = useMemo(
    () =>
      (property?.meterInfo ?? []).filter((m) =>
        METER_UTILITY_TYPES.has(m.utilityType),
      ),
    [property?.meterInfo],
  );

  const meta = utilityType ? utilityMeta[utilityType] : null;

  const prevReading = useMemo(() => {
    if (!utilityType || !property?.readings) return null;
    const sorted = property.readings
      .filter((r) => r.utilityType === utilityType)
      .sort(
        (a, b) =>
          new Date(b.readingDate).getTime() -
          new Date(a.readingDate).getTime(),
      );
    return sorted[0] ?? null;
  }, [utilityType, property?.readings]);

  const prevValue = prevReading ? Number(prevReading.value) : 0;

  const consumption = useMemo(() => {
    const v = Number(value);
    if (!v || v <= prevValue) return 0;
    return v - prevValue;
  }, [value, prevValue]);

  const tariffRate = useMemo(() => {
    if (!utilityType || !property?.tariffGroup?.tariffs) return 0;
    const t = property.tariffGroup.tariffs.find(
      (t) => t.utilityType === utilityType,
    );
    return t ? Number(t.rateHuf) : 0;
  }, [utilityType, property?.tariffGroup?.tariffs]);

  const csatornaTariffRate = useMemo(() => {
    if (!property?.tariffGroup?.tariffs) return 0;
    const t = property.tariffGroup.tariffs.find(
      (t) => t.utilityType === "csatorna",
    );
    return t ? Number(t.rateHuf) : 0;
  }, [property?.tariffGroup?.tariffs]);

  const estimatedCost = consumption * tariffRate;
  const csatornaCost =
    utilityType === "viz" && csatornaTariffRate > 0
      ? consumption * csatornaTariffRate
      : 0;
  const totalCost = estimatedCost + csatornaCost;

  /* ---- OCR handler ---- */
  const handleFileSelected = async (file: File) => {
    setOcrLoading(true);
    setOcrError("");

    // Create local preview
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      // Upload photo
      setUploadingPhoto(true);
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("folder", "meter-readings");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });
      if (uploadRes.ok) {
        const uploaded: unknown = await uploadRes.json();
        if (
          typeof uploaded === "object" &&
          uploaded !== null &&
          "url" in uploaded &&
          typeof uploaded.url === "string"
        ) {
          setPhotoUrl(uploaded.url);
        }
      }

      // OCR
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });
      const data: unknown = await res.json();

      if (
        typeof data === "object" &&
        data !== null &&
        "success" in data &&
        data.success === true &&
        "value" in data &&
        typeof data.value === "number"
      ) {
        setValue(data.value.toString());
        setOcrError("");
      } else if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
      ) {
        setOcrError(data.error);
      } else {
        setOcrError("OCR sikertelen");
      }
    } catch {
      setOcrError("Hiba a fotó feldolgozásakor");
    } finally {
      setOcrLoading(false);
      setUploadingPhoto(false);
    }
  };

  /* ---- submit ---- */
  const handleSubmit = () => {
    if (!utilityType) return;
    createReading.mutate({
      propertyId,
      utilityType,
      value: Number(value),
      readingDate,
      photoUrl,
      notes: notes || undefined,
    });
  };

  /* ---- format helpers ---- */
  const fmtNum = (n: number) => n.toLocaleString("hu-HU");
  const fmtCurrency = (n: number) =>
    `${Math.round(n).toLocaleString("hu-HU")} Ft`;
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("hu-HU");

  /* ---- progress bar ---- */
  const ProgressBar = () => (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i <= step ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-lg items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 0 — Mérőóra választás                                       */
  /* ---------------------------------------------------------------- */

  if (step === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-xl p-2 hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Mérőóra választás</h1>
        </div>

        <ProgressBar />

        {meters.length === 0 ? (
          <div className="rounded-[24px] border border-border/60 bg-card/90 p-8 text-center ring-1 ring-border/60">
            <p className="text-sm text-muted-foreground">
              Nincs mérőóra hozzárendelve ehhez az ingatlanhoz.
            </p>
            <a
              href={`/properties/${propertyId}/meters/new`}
              className="mt-3 inline-block rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Mérőóra hozzáadás
            </a>
          </div>
        ) : (
          <div className="grid gap-3">
            {meters.map((meter) => {
              const ut = meter.utilityType as UtilityType;
              const m = utilityMeta[ut];
              if (!m) return null;
              const Icon = m.icon;

              const lastReading = property?.readings
                ?.filter((r) => r.utilityType === ut)
                .sort(
                  (a, b) =>
                    new Date(b.readingDate).getTime() -
                    new Date(a.readingDate).getTime(),
                )[0];

              return (
                <button
                  key={meter.id}
                  type="button"
                  onClick={() => {
                    setUtilityType(ut);
                    setStep(1);
                  }}
                  className={`flex items-center gap-4 rounded-[24px] border border-border/60 bg-card/90 p-5 text-left ring-1 ring-border/60 transition-colors hover:bg-secondary/50 ${m.borderColor}`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${m.iconBg}`}
                  >
                    <Icon className={`h-6 w-6 ${m.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.label}</p>
                    {meter.serialNumber && (
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {meter.serialNumber}
                      </p>
                    )}
                    {lastReading ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Utolsó: {fmtNum(Number(lastReading.value))} {m.unit} —{" "}
                        {fmtDate(lastReading.readingDate)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Nincs korábbi leolvasás
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 1 — Érték megadás + OCR                                     */
  /* ---------------------------------------------------------------- */

  if (step === 1 && meta && utilityType) {
    const Icon = meta.icon;

    return (
      <div className="mx-auto max-w-lg space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(0)}
            className="rounded-xl p-2 hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconBg}`}>
            <Icon className={`h-4 w-4 ${meta.color}`} />
          </div>
          <div>
            <h1 className="text-lg font-bold">{meta.label}</h1>
            {prevReading && (
              <p className="text-xs text-muted-foreground">
                Előző: {fmtNum(prevValue)} {meta.unit} (
                {fmtDate(prevReading.readingDate)})
              </p>
            )}
          </div>
        </div>

        <ProgressBar />

        {/* Large number input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Mérőállás ({meta.unit})
          </label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`pl. ${prevValue > 0 ? fmtNum(prevValue + 100) : "12345"}`}
            className="h-14 w-full rounded-2xl border border-input bg-background px-4 text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Camera / Gallery buttons */}
        <div className="flex gap-3">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileSelected(f);
            }}
            className="hidden"
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileSelected(f);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={ocrLoading || uploadingPhoto}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            {ocrLoading || uploadingPhoto ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            Kamera
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={ocrLoading || uploadingPhoto}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            {ocrLoading || uploadingPhoto ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            Galéria
          </button>
        </div>

        {/* Photo preview */}
        {photoPreview && (
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={photoPreview}
              alt="Mérőóra fotó"
              className="h-40 w-full object-cover"
            />
          </div>
        )}

        {ocrError && (
          <p className="text-xs text-destructive">{ocrError}</p>
        )}

        {/* Fogyasztás preview card */}
        {consumption > 0 && (
          <div
            className={`rounded-[24px] border p-5 ${meta.bgColor} ${meta.borderColor}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fogyasztás</span>
              <span className="font-semibold">
                {fmtNum(consumption)} {meta.unit}
              </span>
            </div>
            {tariffRate > 0 && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Becsült költség
                </span>
                <span className="font-semibold">{fmtCurrency(estimatedCost)}</span>
              </div>
            )}
            {csatornaCost > 0 && (
              <>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    + Csatorna
                  </span>
                  <span className="font-semibold">
                    {fmtCurrency(csatornaCost)}
                  </span>
                </div>
                <div className="mt-2 border-t border-border/40 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Összesen</span>
                    <span className="font-bold">{fmtCurrency(totalCost)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Date input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Dátum</label>
          <input
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Notes input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Megjegyzés (opcionális)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(0)}
            className="flex-1 rounded-2xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Vissza
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!value || Number(value) <= 0}
            className="flex-1 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Tovább
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 2 — Összegzés                                               */
  /* ---------------------------------------------------------------- */

  if (step === 2 && meta && utilityType) {
    const Icon = meta.icon;

    return (
      <div className="mx-auto max-w-lg space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-xl p-2 hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Összegzés</h1>
        </div>

        <ProgressBar />

        {/* Summary card */}
        <div className="rounded-[24px] border border-border/60 bg-card/90 p-5 ring-1 ring-border/60">
          {/* Meter type */}
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.iconBg}`}
            >
              <Icon className={`h-5 w-5 ${meta.color}`} />
            </div>
            <span className="text-lg font-semibold">{meta.label}</span>
          </div>

          <div className="mt-4 space-y-3">
            {/* New reading */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Új állás</span>
              <span className="font-semibold">
                {fmtNum(Number(value))} {meta.unit}
              </span>
            </div>

            {/* Previous reading */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Előző</span>
              <span className="text-sm">
                {fmtNum(prevValue)} {meta.unit}
              </span>
            </div>

            {/* Consumption */}
            {consumption > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Fogyasztás
                </span>
                <span className="font-semibold">
                  {fmtNum(consumption)} {meta.unit}
                </span>
              </div>
            )}

            {/* Estimated cost */}
            {totalCost > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Becsült költség
                </span>
                <span className="font-semibold">{fmtCurrency(totalCost)}</span>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dátum</span>
              <span className="text-sm">{fmtDate(readingDate)}</span>
            </div>

            {/* Notes */}
            {notes && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Megjegyzés
                </span>
                <span className="max-w-[60%] text-right text-sm">{notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Photo preview */}
        {photoPreview && (
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={photoPreview}
              alt="Mérőóra fotó"
              className="h-40 w-full object-cover"
            />
          </div>
        )}

        {/* Error message */}
        {createReading.error && (
          <p className="text-sm text-destructive">
            Hiba: {createReading.error.message}
          </p>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 rounded-2xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Vissza
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createReading.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {createReading.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {createReading.isPending ? "Mentés..." : "Rögzítés"}
          </button>
        </div>
      </div>
    );
  }

  /* Fallback — should not happen */
  return null;
}
