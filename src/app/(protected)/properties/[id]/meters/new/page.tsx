"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";
import {
  Zap,
  Droplets,
  Flame,
  Waves,
  Gauge,
  Wifi,
  ArrowLeft,
  ChevronRight,
  Check,
  Camera,
  ImageIcon,
  Upload,
  Loader2,
  Copy,
  CheckCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                   */
/* ------------------------------------------------------------------ */

type UtilityType = "villany" | "viz" | "gaz" | "csatorna";
type MeterKind = "manual" | "smart";
type SmartSource = "mqtt" | "ttn" | "home_assistant";

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

interface Preset {
  id: string;
  label: string;
  source: SmartSource;
  valueField: string;
  multiplier: number;
  icon: string;
}

const PRESETS: Preset[] = [
  { id: "shelly_http", label: "Shelly 3EM Pro", source: "mqtt", valueField: "total", multiplier: 0.001, icon: "⚡" },
  { id: "homewizard", label: "HomeWizard P1", source: "mqtt", valueField: "total_power_import_kwh", multiplier: 1, icon: "🔌" },
  { id: "esp32_mqtt", label: "ESP32 MQTT", source: "mqtt", valueField: "meter_value", multiplier: 1, icon: "📡" },
  { id: "zigbee2mqtt", label: "Zigbee2MQTT", source: "mqtt", valueField: "meter_value", multiplier: 1, icon: "📶" },
  { id: "shelly_mqtt", label: "Shelly MQTT", source: "mqtt", valueField: "total", multiplier: 0.001, icon: "🔋" },
  { id: "ttn_lora", label: "TTN LoRaWAN", source: "ttn", valueField: "meter_value", multiplier: 1, icon: "📻" },
  { id: "home_assistant", label: "Home Assistant", source: "home_assistant", valueField: "state", multiplier: 1, icon: "🏠" },
  { id: "custom", label: "Egyéni konfig", source: "mqtt", valueField: "meter_value", multiplier: 1, icon: "⚙️" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewMeterPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  /* ---- wizard state ---- */
  const [step, setStep] = useState(0);
  const [utilityType, setUtilityType] = useState<UtilityType | null>(null);
  const [meterKind, setMeterKind] = useState<MeterKind | null>(null);

  /* ---- manual meter fields ---- */
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");
  const [meterNotes, setMeterNotes] = useState("");
  const [initialReading, setInitialReading] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /* ---- smart meter fields ---- */
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [smartSource, setSmartSource] = useState<SmartSource>("mqtt");
  const [mqttTopic, setMqttTopic] = useState("");
  const [ttnAppId, setTtnAppId] = useState("");
  const [valueField, setValueField] = useState("meter_value");
  const [multiplier, setMultiplier] = useState(1);
  const [offset, setOffset] = useState(0);
  const [minInterval, setMinInterval] = useState(60);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  /* ---- mutations ---- */
  const createMeter = api.meter.create.useMutation();
  const createSmartMeter = api.smartMeter.create.useMutation();
  const recordReading = api.reading.record.useMutation();

  const isSaving =
    createMeter.isPending ||
    createSmartMeter.isPending ||
    recordReading.isPending;

  const mutationError =
    createMeter.error ?? createSmartMeter.error ?? recordReading.error;

  /* ---- derived ---- */
  const meta = utilityType ? utilityMeta[utilityType] : null;
  const webhookUrl = `https://rezsikovetes.hu/api/webhooks/smart-meter?source=${smartSource}`;

  /* ---- photo upload handler ---- */
  const handleFileSelected = async (file: File) => {
    setUploadingPhoto(true);

    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "meters");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const uploaded: unknown = await res.json();
        if (
          typeof uploaded === "object" &&
          uploaded !== null &&
          "url" in uploaded &&
          typeof uploaded.url === "string"
        ) {
          setPhotoUrl(uploaded.url);
        }
      }
    } catch {
      // Upload failed silently — photo is optional
    } finally {
      setUploadingPhoto(false);
    }
  };

  /* ---- preset selection ---- */
  const handlePresetSelect = (preset: Preset) => {
    setSelectedPreset(preset);
    setSmartSource(preset.source);
    setValueField(preset.valueField);
    setMultiplier(preset.multiplier);
    setOffset(0);
    setMinInterval(60);
    setMqttTopic("");
  };

  /* ---- submit ---- */
  const handleSubmit = async () => {
    if (!utilityType || !meterKind) return;

    try {
      // 1. Create meterInfo
      await createMeter.mutateAsync({
        propertyId,
        utilityType,
        serialNumber: serialNumber || undefined,
        location: location || undefined,
      });

      // 2. If smart: create smart meter device
      if (meterKind === "smart") {
        await createSmartMeter.mutateAsync({
          propertyId,
          utilityType,
          deviceId,
          source: smartSource,
          name: deviceName || undefined,
          mqttTopic: smartSource === "mqtt" ? (mqttTopic || `rezsi/${deviceId}`) : undefined,
          ttnAppId: smartSource === "ttn" ? (ttnAppId || undefined) : undefined,
          valueField,
          multiplier,
          offset,
          minIntervalMinutes: minInterval,
        });
      }

      // 3. If manual + initial reading
      if (meterKind === "manual" && initialReading && Number(initialReading) > 0) {
        await recordReading.mutateAsync({
          propertyId,
          utilityType,
          value: Number(initialReading),
          readingDate: new Date().toISOString().split("T")[0]!,
        });
      }

      router.push(`/properties/${propertyId}`);
      router.refresh();
    } catch {
      // Errors are shown via mutationError
    }
  };

  /* ---- copy webhook URL ---- */
  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  /* ---- progress bar ---- */
  const totalSteps = 4; // steps 0..3
  const ProgressBar = () => (
    <div className="flex gap-1.5">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i <= step ? "bg-emerald-500" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Step 0 — Közmű típus                                             */
  /* ---------------------------------------------------------------- */

  if (step === 0) {
    const utilities: UtilityType[] = ["villany", "viz", "gaz", "csatorna"];

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
          <h1 className="text-xl font-bold">Mérőóra hozzáadás</h1>
        </div>

        <ProgressBar />

        <p className="text-sm text-muted-foreground">
          Melyik közműhöz szeretnél mérőórát felvenni?
        </p>

        <div className="grid grid-cols-2 gap-3">
          {utilities.map((ut) => {
            const m = utilityMeta[ut];
            const Icon = m.icon;
            return (
              <button
                key={ut}
                type="button"
                onClick={() => {
                  setUtilityType(ut);
                  setStep(1);
                }}
                className={`flex flex-col items-center gap-3 rounded-[24px] border border-border/60 bg-card/90 p-6 ring-1 ring-border/60 transition-all hover:scale-[1.02] hover:bg-secondary/50 ${m.borderColor}`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${m.iconBg}`}
                >
                  <Icon className={`h-7 w-7 ${m.color}`} />
                </div>
                <span className="text-sm font-semibold">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 1 — Mérő típus                                              */
  /* ---------------------------------------------------------------- */

  if (step === 1 && meta) {
    const UtilIcon = meta.icon;

    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(0)}
            className="rounded-xl p-2 hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconBg}`}>
            <UtilIcon className={`h-4 w-4 ${meta.color}`} />
          </div>
          <h1 className="text-lg font-bold">Mérő típus</h1>
        </div>

        <ProgressBar />

        <p className="text-sm text-muted-foreground">
          Milyen típusú mérőt szeretnél hozzáadni?
        </p>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => {
              setMeterKind("manual");
              setStep(2);
            }}
            className="flex items-center gap-4 rounded-[24px] border border-border/60 bg-card/90 p-5 text-left ring-1 ring-border/60 transition-all hover:scale-[1.01] hover:bg-secondary/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
              <Gauge className="h-6 w-6 text-slate-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Hagyományos mérő</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kézzel olvasom le havonta
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => {
              setMeterKind("smart");
              setStep(2);
            }}
            className="flex items-center gap-4 rounded-[24px] border border-border/60 bg-card/90 p-5 text-left ring-1 ring-border/60 transition-all hover:scale-[1.01] hover:bg-secondary/50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
              <Wifi className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Okos mérő</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Automatikusan küldi az adatot
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 2a — Mérő adatok (manual)                                   */
  /* ---------------------------------------------------------------- */

  if (step === 2 && meterKind === "manual" && meta) {
    const UtilIcon = meta.icon;

    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-xl p-2 hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconBg}`}>
            <UtilIcon className={`h-4 w-4 ${meta.color}`} />
          </div>
          <h1 className="text-lg font-bold">Mérő adatok</h1>
        </div>

        <ProgressBar />

        {/* Serial number */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Gyári szám</label>
          <input
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="pl. ABC123456"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Location */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Helyszín</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="pl. Előszoba, Pince"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Megjegyzés
          </label>
          <textarea
            value={meterNotes}
            onChange={(e) => setMeterNotes(e.target.value)}
            rows={2}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Photo upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Mérőóra fotó</label>
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
              disabled={uploadingPhoto}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Kamera
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={uploadingPhoto}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              Galéria
            </button>
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

        {/* Initial reading */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Kezdő mérőállás ({meta.unit})
          </label>
          <input
            type="number"
            step="0.01"
            value={initialReading}
            onChange={(e) => setInitialReading(e.target.value)}
            placeholder="Opcionális"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Ha megadod, az első leolvasást is rögzítjük.
          </p>
        </div>

        {/* Navigation */}
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
            onClick={() => setStep(3)}
            className="flex-1 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tovább
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 2b — Eszköz konfiguráció (smart)                            */
  /* ---------------------------------------------------------------- */

  if (step === 2 && meterKind === "smart" && meta) {
    const UtilIcon = meta.icon;

    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-xl p-2 hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconBg}`}>
            <UtilIcon className={`h-4 w-4 ${meta.color}`} />
          </div>
          <h1 className="text-lg font-bold">Eszköz konfiguráció</h1>
        </div>

        <ProgressBar />

        {/* Preset selection (show only if no preset selected yet) */}
        {!selectedPreset && (
          <>
            <p className="text-sm text-muted-foreground">
              Válaszd ki az eszközöd típusát:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className="flex flex-col items-center gap-2 rounded-[24px] border border-border/60 bg-card/90 p-4 ring-1 ring-border/60 transition-all hover:scale-[1.02] hover:bg-secondary/50"
                >
                  <span className="text-2xl">{preset.icon}</span>
                  <span className="text-xs font-semibold">{preset.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Config fields (after preset selected) */}
        {selectedPreset && (
          <>
            {/* Selected preset indicator */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/50 p-3">
              <span className="text-xl">{selectedPreset.icon}</span>
              <span className="text-sm font-semibold">{selectedPreset.label}</span>
              <button
                type="button"
                onClick={() => setSelectedPreset(null)}
                className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
              >
                Másik eszköz
              </button>
            </div>

            {/* Device ID */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Eszköz ID <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="pl. shelly3em-001"
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Device name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Eszköz neve
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="pl. Nappali villany mérő"
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Source */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Forrás</label>
              <div className="flex gap-2">
                {(["mqtt", "ttn", "home_assistant"] as const).map((src) => {
                  const labels: Record<SmartSource, string> = {
                    mqtt: "MQTT",
                    ttn: "TTN",
                    home_assistant: "Home Assistant",
                  };
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setSmartSource(src)}
                      className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${
                        smartSource === src
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {labels[src]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MQTT topic — only if mqtt */}
            {smartSource === "mqtt" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  MQTT topic
                </label>
                <input
                  type="text"
                  value={mqttTopic}
                  onChange={(e) => setMqttTopic(e.target.value)}
                  placeholder={deviceId ? `rezsi/${deviceId}` : "rezsi/{deviceId}"}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {/* TTN App ID — only if ttn */}
            {smartSource === "ttn" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  TTN App ID
                </label>
                <input
                  type="text"
                  value={ttnAppId}
                  onChange={(e) => setTtnAppId(e.target.value)}
                  placeholder="pl. my-ttn-app"
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {/* Value field */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Érték mező
              </label>
              <input
                type="text"
                value={valueField}
                onChange={(e) => setValueField(e.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Multiplier + Offset side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Szorzó</label>
                <input
                  type="number"
                  step="0.001"
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Eltolás</label>
                <input
                  type="number"
                  step="0.01"
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Min interval */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Min. intervallum (perc)
              </label>
              <input
                type="number"
                value={minInterval}
                onChange={(e) => setMinInterval(Number(e.target.value))}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Webhook URL */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Webhook URL
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-3">
                <code className="min-w-0 flex-1 truncate text-xs">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyWebhook()}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copiedWebhook ? (
                    <CheckCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedPreset) {
                setSelectedPreset(null);
              } else {
                setStep(1);
              }
            }}
            className="flex-1 rounded-2xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Vissza
          </button>
          {selectedPreset && (
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!deviceId.trim()}
              className="flex-1 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Tovább
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 3 — Összegzés                                               */
  /* ---------------------------------------------------------------- */

  if (step === 3 && meta && utilityType && meterKind) {
    const UtilIcon = meta.icon;
    const sourceLabels: Record<SmartSource, string> = {
      mqtt: "MQTT",
      ttn: "TTN LoRaWAN",
      home_assistant: "Home Assistant",
    };

    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-xl p-2 hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Összegzés</h1>
        </div>

        <ProgressBar />

        {/* Summary card */}
        <div className="rounded-[24px] border border-border/60 bg-card/90 p-5 ring-1 ring-border/60">
          {/* Utility type */}
          <div className="flex items-center gap-3 border-b border-border/40 pb-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.iconBg}`}
            >
              <UtilIcon className={`h-5 w-5 ${meta.color}`} />
            </div>
            <div>
              <p className="text-lg font-semibold">{meta.label}</p>
              <p className="text-xs text-muted-foreground">
                {meterKind === "manual" ? "Hagyományos mérő" : "Okos mérő"}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {/* Manual meter details */}
            {meterKind === "manual" && (
              <>
                {serialNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Gyári szám
                    </span>
                    <span className="font-mono text-sm font-semibold">
                      {serialNumber}
                    </span>
                  </div>
                )}
                {location && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Helyszín
                    </span>
                    <span className="text-sm">{location}</span>
                  </div>
                )}
                {initialReading && Number(initialReading) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Kezdő állás
                    </span>
                    <span className="font-semibold">
                      {Number(initialReading).toLocaleString("hu-HU")} {meta.unit}
                    </span>
                  </div>
                )}
                {meterNotes && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Megjegyzés
                    </span>
                    <span className="max-w-[60%] text-right text-sm">
                      {meterNotes}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Smart meter details */}
            {meterKind === "smart" && selectedPreset && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Eszköz</span>
                  <span className="text-sm font-semibold">
                    {selectedPreset.icon} {selectedPreset.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Eszköz ID
                  </span>
                  <span className="font-mono text-sm font-semibold">
                    {deviceId}
                  </span>
                </div>
                {deviceName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Név</span>
                    <span className="text-sm">{deviceName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Forrás</span>
                  <span className="text-sm">{sourceLabels[smartSource]}</span>
                </div>
                {smartSource === "mqtt" && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Topic</span>
                    <span className="max-w-[60%] truncate font-mono text-xs">
                      {mqttTopic || `rezsi/${deviceId}`}
                    </span>
                  </div>
                )}
                {smartSource === "ttn" && ttnAppId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      TTN App ID
                    </span>
                    <span className="font-mono text-xs">{ttnAppId}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Érték mező
                  </span>
                  <span className="font-mono text-xs">{valueField}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Szorzó</span>
                  <span className="text-sm">{multiplier}</span>
                </div>
                {offset !== 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Eltolás</span>
                    <span className="text-sm">{offset}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Intervallum
                  </span>
                  <span className="text-sm">{minInterval} perc</span>
                </div>
              </>
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

        {/* Error */}
        {mutationError && (
          <p className="text-sm text-destructive">
            Hiba: {mutationError.message}
          </p>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="flex-1 rounded-2xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Vissza
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isSaving ? "Mentés..." : "Mérő hozzáadása"}
          </button>
        </div>
      </div>
    );
  }

  /* Fallback — should not happen */
  return null;
}
