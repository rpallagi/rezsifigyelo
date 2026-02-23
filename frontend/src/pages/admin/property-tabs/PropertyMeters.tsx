import { useEffect, useState, useRef } from "react";
import {
  Gauge, Plus, Pencil, Trash2, Activity, Wifi, AlertTriangle, Globe,
  BookOpen, Zap, Droplets, Flame, ClipboardList, Radio, Camera, Upload,
  Check, ChevronRight, ArrowLeft, Loader2, X, Copy,
} from "lucide-react";
import {
  getPropertyMeters, addMeter, editMeter, deleteMeter,
  getPropertySmartMeters, addSmartMeter, editSmartMeter, deleteSmartMeter,
  getSmartMeterLogs, getSmartMeterStatus, ocrMeterPhoto, adminSubmitReading,
  getHomeAssistantEntities, importHomeAssistantMeters, backfillHomeAssistantMonthly, getHomeAssistantSettings, saveHomeAssistantSettings, testHomeAssistantConnection,
  type MeterInfoItem, type SmartMeterDeviceItem, type SmartMeterLogItem, type HomeAssistantEntityItem,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import AiChat from "@/components/AiChat";

interface Props {
  propertyId: number;
}

// ────────────────────────────────────────
// Smart meter device presets
// ────────────────────────────────────────
const DEVICE_PRESETS = {
  custom: { name: "", device_id: "", source: "http" as const, value_field: "value", multiplier: "1.0", offset: "0.0", mqtt_topic: "" },
  shelly_http: { name: "Shelly 3EM Pro", device_id: "shelly-3em-", source: "http" as const, value_field: "total", multiplier: "0.001", offset: "0.0", mqtt_topic: "" },
  homewizard: { name: "HomeWizard P1", device_id: "homewizard-p1-", source: "http" as const, value_field: "total_power_import_kwh", multiplier: "1.0", offset: "0.0", mqtt_topic: "" },
  esp32_http: { name: "ESP32 HTTP", device_id: "esp32-", source: "http" as const, value_field: "value", multiplier: "1.0", offset: "0.0", mqtt_topic: "" },
  ha: { name: "Home Assistant", device_id: "ha-", source: "http" as const, value_field: "state", multiplier: "1.0", offset: "0.0", mqtt_topic: "" },
  esp32_mqtt: { name: "ESP32 MQTT", device_id: "esp32-", source: "mqtt" as const, value_field: "value", multiplier: "1.0", offset: "0.0", mqtt_topic: "rezsi/{device_id}" },
  zigbee2mqtt: { name: "Zigbee2MQTT", device_id: "z2m-", source: "mqtt" as const, value_field: "energy", multiplier: "1.0", offset: "0.0", mqtt_topic: "zigbee2mqtt/{friendly_name}" },
  shelly_mqtt: { name: "Shelly MQTT", device_id: "shelly-", source: "mqtt" as const, value_field: "total", multiplier: "0.001", offset: "0.0", mqtt_topic: "shellies/{id}/emeter/0/total" },
};

type PresetKey = keyof typeof DEVICE_PRESETS;
type UtilityType = "villany" | "viz" | "gaz";
type MeterKind = "manual" | "smart";

// ────────────────────────────────────────
// Wizard step types
// ────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4 | 5;

interface WizardState {
  step: WizardStep;
  utilityType: UtilityType;
  meterKind: MeterKind;
  // Manual meter fields
  serialNumber: string;
  location: string;
  notes: string;
  initialReading: string;
  photo: File | null;
  ocrValue: number | null;
  ocrConfidence: string;
  ocrRunning: boolean;
  ocrRawText: string;
  // Smart meter fields
  preset: PresetKey;
  smartName: string;
  smartDeviceId: string;
  smartSource: "http" | "mqtt" | "ttn";
  smartValueField: string;
  smartMultiplier: string;
  smartOffset: string;
  smartMinInterval: string;
  smartMqttTopic: string;
  smartTtnAppId: string;
  smartHaEntityId: string;
  smartIsActive: boolean;
}

const initialWizard: WizardState = {
  step: 1,
  utilityType: "villany",
  meterKind: "manual",
  serialNumber: "",
  location: "",
  notes: "",
  initialReading: "",
  photo: null,
  ocrValue: null,
  ocrConfidence: "",
  ocrRunning: false,
  ocrRawText: "",
  preset: "custom",
  smartName: "",
  smartDeviceId: "",
  smartSource: "http",
  smartValueField: "value",
  smartMultiplier: "1.0",
  smartOffset: "0.0",
  smartMinInterval: "60",
  smartMqttTopic: "",
  smartTtnAppId: "",
  smartHaEntityId: "",
  smartIsActive: true,
};

// ────────────────────────────────────────
// Smart meter edit form
// ────────────────────────────────────────
const emptySmartForm = {
  name: "", device_id: "", source: "http" as "ttn" | "mqtt" | "http",
  utility_type: "villany" as UtilityType, value_field: "value",
  multiplier: "1.0", offset: "0.0", min_interval_minutes: "60",
  mqtt_topic: "", ttn_app_id: "", is_active: true,
};

// ════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════
const PropertyMeters = ({ propertyId }: Props) => {
  const { t } = useI18n();

  // Data
  const [physicalMeters, setPhysicalMeters] = useState<MeterInfoItem[]>([]);
  const [smartDevices, setSmartDevices] = useState<SmartMeterDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // MQTT status
  const [mqttInfo, setMqttInfo] = useState<{ mqtt_connected: boolean; mqtt_enabled: boolean; mqtt_broker_host?: string; mqtt_broker_port?: number; mqtt_topic_prefix?: string } | null>(null);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wiz, setWiz] = useState<WizardState>(initialWizard);
  const [wizSaving, setWizSaving] = useState(false);
  const [showAdvancedSmart, setShowAdvancedSmart] = useState(false);
  const [showOtherSmartPresets, setShowOtherSmartPresets] = useState(false);
  const [haEntityOptions, setHaEntityOptions] = useState<HomeAssistantEntityItem[]>([]);
  const [haEntityLoading, setHaEntityLoading] = useState(false);
  const [haEntityError, setHaEntityError] = useState("");
  const [haImportOpen, setHaImportOpen] = useState(false);
  const [haImportLoading, setHaImportLoading] = useState(false);
  const [haImportSaving, setHaImportSaving] = useState(false);
  const [haImportEntities, setHaImportEntities] = useState<HomeAssistantEntityItem[]>([]);
  const [haImportSelected, setHaImportSelected] = useState<Record<string, boolean>>({});
  const [haImportResult, setHaImportResult] = useState<{ created: number; verified: number; failed: number } | null>(null);
  const [haImportSearch, setHaImportSearch] = useState("");
  const [haImportUtilityFilter, setHaImportUtilityFilter] = useState<"all" | UtilityType>("all");
  const [haBackfillMonths, setHaBackfillMonths] = useState("12");
  const [haBackfillRunning, setHaBackfillRunning] = useState(false);
  const [haSetupOpen, setHaSetupOpen] = useState(false);
  const [haSetupUrl, setHaSetupUrl] = useState("");
  const [haSetupToken, setHaSetupToken] = useState("");
  const [haSetupName, setHaSetupName] = useState("");
  const [haSetupLocation, setHaSetupLocation] = useState("");
  const [haSetupLocalUser, setHaSetupLocalUser] = useState("");
  const [haSetupLocalPassword, setHaSetupLocalPassword] = useState("");
  const [haSetupSaving, setHaSetupSaving] = useState(false);
  const [haSetupTesting, setHaSetupTesting] = useState(false);
  const [haSetupStatus, setHaSetupStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Edit physical meter
  const [editPhysicalOpen, setEditPhysicalOpen] = useState(false);
  const [editPhysicalId, setEditPhysicalId] = useState<number | null>(null);
  const [physForm, setPhysForm] = useState({ serial_number: "", location: "", notes: "", utility_type: "villany" as UtilityType });

  // Edit smart meter
  const [editSmartOpen, setEditSmartOpen] = useState(false);
  const [editSmartId, setEditSmartId] = useState<number | null>(null);
  const [smartForm, setSmartForm] = useState(emptySmartForm);
  const [smartFormSaving, setSmartFormSaving] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "physical" | "smart"; id: number } | null>(null);

  // Logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsName, setLogsName] = useState("");
  const [logs, setLogs] = useState<SmartMeterLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load data ──
  const load = async () => {
    setLoading(true);
    try {
      const [mRes, sRes, statusRes] = await Promise.all([
        getPropertyMeters(propertyId),
        getPropertySmartMeters(propertyId),
        getSmartMeterStatus().catch(() => null),
      ]);
      setPhysicalMeters((mRes as any).meters || []);
      setSmartDevices((sRes as any).devices || []);
      if (statusRes) setMqttInfo(statusRes as any);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [propertyId]);

  // ── Utility helpers ──
  const utilityIcon = (type: string) => {
    if (type === "villany") return <Zap className="h-4 w-4 text-yellow-500" />;
    if (type === "viz") return <Droplets className="h-4 w-4 text-blue-500" />;
    return <Flame className="h-4 w-4 text-orange-500" />;
  };
  const utilityLabel = (type: string) => {
    if (type === "villany") return t("common.villany");
    if (type === "viz") return t("common.viz");
    return t("common.gaz");
  };
  const utilityUnit = (type: string) => type === "villany" ? "kWh" : "m³";

  const sanitizeTopicSegment = (value: string) => {
    const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return sanitized || "meter-01";
  };

  const suggestedTopicForDevice = (deviceId: string) =>
    `rpallagi/property-${propertyId}/unit-main/${sanitizeTopicSegment(deviceId || "meter-01")}/telemetry`;

  const suggestedValueField = (utility: UtilityType) =>
    utility === "villany" ? "energy_kwh_total" : utility === "gaz" ? "energy_m3_total" : "water_m3_total";

  const defaultHaDeviceId = (utility: UtilityType) =>
    `ha-p${propertyId}-${utility}-01`;

  const generateApiToken = () => {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return `sm-${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  };

  const normalizeHaEntityId = (value: string) => {
    const trimmed = (value || "").trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith("sensor.") ? trimmed : `sensor.${trimmed}`;
  };

  const haEntitySuffix = (entityId: string) => {
    const normalized = normalizeHaEntityId(entityId);
    return normalized.startsWith("sensor.") ? normalized.slice(7) : normalized;
  };

  const isValidHaEntity = (entityId: string) => /^sensor\.[a-z0-9_]+$/.test(normalizeHaEntityId(entityId));

  const isHaSimpleFlow = wiz.meterKind === "smart" && wiz.preset === "ha";
  const haPayloadField = suggestedValueField(wiz.utilityType);
  const haYamlSnippet = `rest_command:
  rezsi_${wiz.utilityType}_send:
    url: "${window.location.origin}/api/webhooks/generic"
    method: POST
    headers:
      Authorization: "Bearer ${wiz.smartTtnAppId || "TOKEN_IDE"}"
      Content-Type: "application/json"
    payload: >
      {"device_id":"${wiz.smartDeviceId || defaultHaDeviceId(wiz.utilityType)}","${haPayloadField}":"{{ states('${normalizeHaEntityId(wiz.smartHaEntityId) || "sensor.meter_entity_id"}') }}","timestamp":"{{ now().isoformat() }}"}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("meters.haCopySuccess"));
    } catch {
      toast.error(t("meters.haCopyError"));
    }
  };

  const loadHaEntitiesForWizard = async () => {
    setHaEntityLoading(true);
    setHaEntityError("");
    try {
      const res = await getHomeAssistantEntities(propertyId);
      const entities = (res.entities || [])
        .filter((e) => e.entity_id.startsWith("sensor."))
        .filter((e) => e.utility_type === wiz.utilityType || !e.utility_type);
      setHaEntityOptions(entities);
      if (!entities.length) {
        setHaEntityError(t("meters.haNoEntitiesFound"));
      }
    } catch (e: any) {
      const msg = e.message || t("meters.haLoadEntitiesError");
      setHaEntityError(msg);
      if (/hiányzik|required|missing/i.test(msg)) {
        setHaSetupOpen(true);
        await loadHaSetupFromSettings();
      }
    } finally {
      setHaEntityLoading(false);
    }
  };

  const loadHaSetupFromSettings = async () => {
    try {
      const s = await getHomeAssistantSettings(propertyId);
      setHaSetupUrl((s.ha_base_url || "").trim());
      setHaSetupToken((s.ha_token || "").trim());
      setHaSetupName((s.ha_name || "").trim());
      setHaSetupLocation((s.ha_location || "").trim());
      setHaSetupLocalUser((s.ha_local_username || "").trim());
      setHaSetupLocalPassword((s.ha_local_password || "").trim());
      return s;
    } catch {
      // keep current values
      return null;
    }
  };

  const saveHaSetupFromDialog = async () => {
    setHaSetupSaving(true);
    setHaSetupStatus(null);
    try {
      await saveHomeAssistantSettings({
        ha_name: haSetupName.trim(),
        ha_location: haSetupLocation.trim(),
        ha_local_username: haSetupLocalUser.trim(),
        ha_local_password: haSetupLocalPassword.trim(),
        ha_base_url: haSetupUrl.trim(),
        ha_token: haSetupToken.trim(),
      }, propertyId);
      setHaSetupStatus({ ok: true, msg: t("meters.haSetupSaved") });
    } catch (e: any) {
      setHaSetupStatus({ ok: false, msg: e.message || t("meters.haSetupSaveError") });
    } finally {
      setHaSetupSaving(false);
    }
  };

  const testHaSetupFromDialog = async () => {
    setHaSetupTesting(true);
    setHaSetupStatus(null);
    try {
      await saveHomeAssistantSettings({
        ha_name: haSetupName.trim(),
        ha_location: haSetupLocation.trim(),
        ha_local_username: haSetupLocalUser.trim(),
        ha_local_password: haSetupLocalPassword.trim(),
        ha_base_url: haSetupUrl.trim(),
        ha_token: haSetupToken.trim(),
      }, propertyId);
      const res = await testHomeAssistantConnection(propertyId);
      setHaSetupStatus({
        ok: true,
        msg: t("meters.haSetupTestOk")
          .replace("{sensors}", String(res.sensor_count))
          .replace("{entities}", String(res.total_entities)),
      });
      setHaSetupOpen(false);
    } catch (e: any) {
      setHaSetupStatus({ ok: false, msg: e.message || t("meters.haSetupTestError") });
    } finally {
      setHaSetupTesting(false);
    }
  };

  const loadHaImportEntities = async () => {
    setHaImportLoading(true);
    setHaImportResult(null);
    try {
      const res = await getHomeAssistantEntities(propertyId);
      const entities = (res.entities || []).filter((e) => e.entity_id.startsWith("sensor."));
      setHaImportEntities(entities);
      const nextSelected: Record<string, boolean> = {};
      for (const entity of entities) {
        if (entity.numeric) nextSelected[entity.entity_id] = true;
      }
      setHaImportSelected(nextSelected);
      if (!entities.length) {
        toast.warning(t("meters.haNoEntitiesFound"));
      }
    } catch (e: any) {
      const msg = e.message || t("meters.haLoadEntitiesError");
      toast.error(msg);
      if (/hiányzik|required|missing/i.test(msg)) {
        setHaSetupOpen(true);
        await loadHaSetupFromSettings();
      }
      setHaImportEntities([]);
      setHaImportSelected({});
    } finally {
      setHaImportLoading(false);
    }
  };

  const filteredHaImportEntities = haImportEntities.filter((entity) => {
    const utilityOk = haImportUtilityFilter === "all" || entity.utility_type === haImportUtilityFilter;
    if (!utilityOk) return false;
    const q = haImportSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${entity.entity_id} ${entity.friendly_name || ""} ${entity.unit || ""} ${entity.state || ""}`.toLowerCase();
    return haystack.includes(q);
  });

  const selectAllHaImportEntities = () => {
    const next = { ...haImportSelected };
    for (const entity of filteredHaImportEntities) {
      next[entity.entity_id] = true;
    }
    setHaImportSelected(next);
  };

  const selectNumericHaImportEntities = () => {
    const next = { ...haImportSelected };
    for (const entity of filteredHaImportEntities) {
      if (entity.numeric) next[entity.entity_id] = true;
    }
    setHaImportSelected(next);
  };

  const clearHaImportSelection = () => {
    if (!filteredHaImportEntities.length) {
      setHaImportSelected({});
      return;
    }
    const removeIds = new Set(filteredHaImportEntities.map((entity) => entity.entity_id));
    const next: Record<string, boolean> = {};
    for (const [entityId, checked] of Object.entries(haImportSelected)) {
      if (checked && !removeIds.has(entityId)) next[entityId] = true;
    }
    setHaImportSelected(next);
  };

  const selectedHaImportCount = haImportEntities.reduce(
    (sum, entity) => sum + (haImportSelected[entity.entity_id] ? 1 : 0),
    0,
  );

  const selectedFilteredHaImportCount = filteredHaImportEntities.reduce(
    (sum, entity) => sum + (haImportSelected[entity.entity_id] ? 1 : 0),
    0,
  );

  const openHaImportDialog = async () => {
    const setup = await loadHaSetupFromSettings();
    const hasConnection = Boolean((setup?.ha_base_url || "").trim() && (setup?.ha_token || "").trim());
    setHaSetupOpen(!hasConnection);
    setHaImportSearch("");
    setHaImportUtilityFilter("all");
    setHaImportOpen(true);
    await loadHaImportEntities();
  };

  const runHaImport = async () => {
    const selected = haImportEntities.filter((e) => haImportSelected[e.entity_id]);
    if (!selected.length) {
      toast.warning(t("meters.haImportSelectAtLeastOne"));
      return;
    }
    setHaImportSaving(true);
    try {
      const res = await importHomeAssistantMeters(propertyId, selected.map((e) => ({
        entity_id: e.entity_id,
        utility_type: e.utility_type as UtilityType,
        name: e.friendly_name,
      })));
      const created = (res.created || []).length;
      const verified = (res.verify || []).filter((v: any) => v.ok).length;
      const failed = (res.verify || []).filter((v: any) => !v.ok).length;
      setHaImportResult({ created, verified, failed });
      await load();
      toast.success(t("meters.haImportSuccess")
        .replace("{created}", String(created))
        .replace("{verified}", String(verified))
        .replace("{failed}", String(failed)));
    } catch (e: any) {
      toast.error(e.message || t("meters.haImportError"));
    } finally {
      setHaImportSaving(false);
    }
  };

  const runHaMonthlyBackfill = async (untilDataStart = false) => {
    const months = Math.max(1, Math.min(120, Number(haBackfillMonths) || 12));
    setHaBackfillRunning(true);
    try {
      const res = await backfillHomeAssistantMonthly(propertyId, {
        months_back: months,
        until_data_start: untilDataStart,
      });
      await load();
      if (res.no_targets || ((res.created || 0) === 0 && (res.devices || []).length === 0 && res.message)) {
        toast.warning(res.message || t("meters.haBackfillNeedsImport"));
      } else {
        toast.success(
          t("meters.haBackfillSuccess")
            .replace("{created}", String(res.created || 0))
            .replace("{skipped}", String(res.skipped || 0)),
        );
      }
      if ((res.errors || []).length) {
        toast.warning(t("meters.haBackfillPartial").replace("{count}", String(res.errors.length)));
      }
    } catch (e: any) {
      toast.error(e.message || t("meters.haBackfillError"));
    } finally {
      setHaBackfillRunning(false);
    }
  };

  const sourceBadge = (source: string) => {
    const cls = source === "mqtt"
      ? "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400"
      : source === "ttn"
        ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400"
        : "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400";
    return <Badge variant="outline" className={`text-[10px] ${cls}`}>{source.toUpperCase()}</Badge>;
  };

  // ── Wizard helpers ──
  const setW = <K extends keyof WizardState>(key: K, val: WizardState[K]) =>
    setWiz(w => ({ ...w, [key]: val }));

  const openWizard = () => {
    setWiz(initialWizard);
    setShowAdvancedSmart(false);
    setShowOtherSmartPresets(false);
    setHaEntityOptions([]);
    setHaEntityError("");
    setWizardOpen(true);
  };

  const applyPreset = (key: PresetKey) => {
    const p = DEVICE_PRESETS[key];
    setWiz(w => ({
      ...w,
      preset: key,
      smartName: p.name,
      smartDeviceId: key === "ha"
        ? (w.smartDeviceId.trim() || defaultHaDeviceId(w.utilityType))
        : (w.smartDeviceId || p.device_id),
      smartSource: key === "ha" ? "http" : p.source as any,
      smartValueField: key === "ha" ? suggestedValueField(w.utilityType) : p.value_field,
      smartMultiplier: p.multiplier,
      smartOffset: p.offset,
      smartMinInterval: key === "ha" ? (w.utilityType === "villany" ? "1" : "5") : w.smartMinInterval,
      smartTtnAppId: key === "ha" ? (w.smartTtnAppId || generateApiToken()) : w.smartTtnAppId,
      smartHaEntityId: key === "ha" ? normalizeHaEntityId(w.smartHaEntityId) : w.smartHaEntityId,
      smartMqttTopic: p.mqtt_topic,
    }));
    setShowAdvancedSmart(false);
    if (key === "ha") setShowOtherSmartPresets(false);
  };

  useEffect(() => {
    if (!isHaSimpleFlow) return;
    setWiz((w) => {
      const nextDeviceId = w.smartDeviceId.trim() ? w.smartDeviceId : defaultHaDeviceId(w.utilityType);
      const nextField = suggestedValueField(w.utilityType);
      const nextMin = w.utilityType === "villany" ? "1" : "5";
      if (
        w.smartSource === "http" &&
        w.smartValueField === nextField &&
        w.smartMinInterval === nextMin &&
        w.smartDeviceId === nextDeviceId
      ) {
        return w;
      }
      return {
        ...w,
        smartSource: "http",
        smartValueField: nextField,
        smartMinInterval: nextMin,
        smartDeviceId: nextDeviceId,
      };
    });
  }, [isHaSimpleFlow, wiz.utilityType]);

  useEffect(() => {
    if (!isHaSimpleFlow) return;
    setHaEntityOptions([]);
    setHaEntityError("");
  }, [isHaSimpleFlow, wiz.utilityType]);

  // ── OCR photo ──
  const handlePhoto = async (file: File) => {
    setW("photo", file);
    setW("ocrRunning", true);
    setW("ocrValue", null);
    setW("ocrConfidence", "");
    setW("ocrRawText", "");
    try {
      const res = await ocrMeterPhoto(file, "admin");
      if (res.value !== null) {
        setWiz(w => ({
          ...w,
          ocrValue: res.value,
          ocrConfidence: res.confidence,
          ocrRawText: res.raw_text || "",
          initialReading: String(res.value),
          ocrRunning: false,
        }));
        toast.success(t("meters.ocrSuccess"));
      } else {
        setWiz(w => ({ ...w, ocrRunning: false, ocrConfidence: "low", ocrRawText: res.raw_text || "" }));
        toast.warning(t("meters.ocrFailed"));
      }
    } catch (e: any) {
      setWiz(w => ({ ...w, ocrRunning: false }));
      toast.error(e.message || t("meters.ocrFailed"));
    }
  };

  // ── Save wizard ──
  const saveWizard = async () => {
    setWizSaving(true);
    try {
      if (wiz.meterKind === "manual") {
        // 1. Create MeterInfo
        await addMeter(propertyId, {
          utility_type: wiz.utilityType,
          serial_number: wiz.serialNumber.trim() || null,
          location: wiz.location.trim() || null,
          notes: wiz.notes.trim() || null,
        });
        // 2. Create initial reading if value provided
        const val = parseFloat(wiz.initialReading);
        if (!isNaN(val) && val > 0) {
          const fd = new FormData();
          fd.append("property_id", String(propertyId));
          fd.append("utility_type", wiz.utilityType);
          fd.append("value", String(val));
          fd.append("reading_date", new Date().toISOString().slice(0, 10));
          if (wiz.photo) fd.append("photo", wiz.photo);
          await adminSubmitReading(fd);
        }
        toast.success(t("meters.saved"));
      } else {
        // Smart meter
        const smartDeviceId = (wiz.smartDeviceId.trim() || (isHaSimpleFlow ? defaultHaDeviceId(wiz.utilityType) : "")).trim();
        if (!smartDeviceId) {
          throw new Error("Eszköz azonosító hiányzik.");
        }
        await addSmartMeter(propertyId, {
          name: wiz.smartName.trim() || (isHaSimpleFlow ? `Home Assistant ${utilityLabel(wiz.utilityType)}` : null),
          device_id: smartDeviceId,
          source: isHaSimpleFlow ? "http" : wiz.smartSource,
          utility_type: wiz.utilityType,
          value_field: (isHaSimpleFlow ? haPayloadField : wiz.smartValueField).trim() || suggestedValueField(wiz.utilityType),
          multiplier: parseFloat(wiz.smartMultiplier) || 1.0,
          offset: parseFloat(wiz.smartOffset) || 0.0,
          min_interval_minutes: parseInt(wiz.smartMinInterval, 10) || 60,
          mqtt_topic: wiz.smartSource === "mqtt" ? ((wiz.smartMqttTopic.trim() || suggestedTopicForDevice(smartDeviceId)).trim()) : null,
          ttn_app_id: (isHaSimpleFlow || wiz.smartSource === "http" || wiz.smartSource === "ttn")
            ? (wiz.smartTtnAppId.trim() || null)
            : null,
          is_active: wiz.smartIsActive,
        });
        toast.success(t("meters.smartSaved"));
      }
      setWizardOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    } finally {
      setWizSaving(false);
    }
  };

  // ── Edit physical meter ──
  const openEditPhysical = (m: MeterInfoItem) => {
    setEditPhysicalId(m.id);
    setPhysForm({ serial_number: m.serial_number || "", location: m.location || "", notes: m.notes || "", utility_type: m.utility_type as UtilityType });
    setEditPhysicalOpen(true);
  };
  const savePhysical = async () => {
    if (!editPhysicalId) return;
    try {
      await editMeter(editPhysicalId, physForm);
      setEditPhysicalOpen(false);
      load();
      toast.success(t("smartMeter.updated"));
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Edit smart meter ──
  const openEditSmart = (d: SmartMeterDeviceItem) => {
    setEditSmartId(d.id);
    setSmartForm({
      name: d.name || "", device_id: d.device_id, source: d.source as any,
      utility_type: d.utility_type as UtilityType, value_field: d.value_field || "value",
      multiplier: String(d.multiplier), offset: String(d.offset),
      min_interval_minutes: String(d.min_interval_minutes),
      mqtt_topic: d.mqtt_topic || "", ttn_app_id: d.ttn_app_id || "", is_active: d.is_active,
    });
    setEditSmartOpen(true);
  };
  const saveSmart = async () => {
    if (!editSmartId) return;
    setSmartFormSaving(true);
    try {
      await editSmartMeter(editSmartId, {
        name: smartForm.name.trim() || null,
        device_id: smartForm.device_id.trim(),
        source: smartForm.source,
        utility_type: smartForm.utility_type,
        value_field: smartForm.value_field.trim() || suggestedValueField(smartForm.utility_type),
        multiplier: parseFloat(smartForm.multiplier) || 1.0,
        offset: parseFloat(smartForm.offset) || 0.0,
        min_interval_minutes: parseInt(smartForm.min_interval_minutes, 10) || 60,
        mqtt_topic: smartForm.source === "mqtt" ? ((smartForm.mqtt_topic.trim() || suggestedTopicForDevice(smartForm.device_id)).trim()) : null,
        ttn_app_id: (smartForm.source === "ttn" || smartForm.source === "http") ? (smartForm.ttn_app_id.trim() || null) : null,
        is_active: smartForm.is_active,
      });
      setEditSmartOpen(false);
      load();
      toast.success(t("smartMeter.updated"));
    } catch (e: any) { toast.error(e.message); } finally { setSmartFormSaving(false); }
  };

  // ── Toggle smart active ──
  const toggleActive = async (d: SmartMeterDeviceItem) => {
    try {
      await editSmartMeter(d.id, { is_active: !d.is_active });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "physical") await deleteMeter(deleteConfirm.id);
      else await deleteSmartMeter(deleteConfirm.id);
      setDeleteConfirm(null);
      load();
      toast.success(t("smartMeter.deleted"));
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Logs ──
  const openLogs = async (d: SmartMeterDeviceItem) => {
    setLogsName(d.name || d.device_id);
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const data = await getSmartMeterLogs(d.id);
      setLogs((data as any).logs || []);
    } catch { setLogs([]); } finally { setLogsLoading(false); }
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  const totalMeters = physicalMeters.length + smartDevices.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="glass-card p-3 px-5">
          <span className="text-xs text-muted-foreground">{t("meters.title")}: </span>
          <span className="font-display font-bold">{totalMeters}</span>
          <span className="text-xs text-muted-foreground ml-1">
            ({physicalMeters.length} {t("meters.physical").toLowerCase()}, {smartDevices.length} {t("meters.smart").toLowerCase()})
          </span>
        </div>
        <Button onClick={openWizard} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t("meters.addNew")}
        </Button>
      </div>

      {/* Empty state */}
      {totalMeters === 0 && (
        <div className="glass-card p-8 text-center">
          <Gauge className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("meters.noMeters")}</p>
        </div>
      )}

      {/* ── Physical meters ── */}
      {physicalMeters.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1 flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> {t("meters.physical")}
          </h3>
          {physicalMeters.map(m => (
            <div key={`p-${m.id}`} className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                {utilityIcon(m.utility_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-display font-bold text-base">{utilityLabel(m.utility_type)}</span>
                  <Badge variant="outline" className="text-[10px]">{t("meters.typeManual")}</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                  {m.serial_number && <span>{t("meters.serialNumber")}: {m.serial_number}</span>}
                  {m.location && <span>{t("meters.location")}: {m.location}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPhysical(m)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: "physical", id: m.id })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Smart meters ── */}
      {smartDevices.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" /> {t("meters.smart")}
          </h3>
          {smartDevices.map(d => (
            <div key={`s-${d.id}`} className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                  {d.source === "mqtt" ? <Activity className="h-5 w-5 text-accent-foreground" />
                    : d.source === "ttn" ? <Wifi className="h-5 w-5 text-accent-foreground" />
                    : <Globe className="h-5 w-5 text-accent-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-display font-bold text-base truncate">{d.name || d.device_id}</span>
                    {sourceBadge(d.source)}
                    {utilityIcon(d.utility_type)}
                    {!d.is_active && <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-500">{t("smartMeter.inactive")}</Badge>}
                  </div>
                  {d.name && (
                    <div className="text-xs text-muted-foreground mb-1">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{d.device_id}</code>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {d.last_seen_at ? (
                      <>
                        <span>{t("smartMeter.lastSeen")}: {formatDate(d.last_seen_at)}</span>
                        {d.last_raw_value !== null && <span>{t("smartMeter.lastValue")}: {d.last_raw_value}</span>}
                      </>
                    ) : (
                      <span className="italic">{t("smartMeter.noDataReceived")}</span>
                    )}
                  </div>
                  {d.last_error && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{d.last_error}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch checked={d.is_active} onCheckedChange={() => toggleActive(d)} className="mr-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openLogs(d)} title={t("smartMeter.logs")}>
                    <Activity className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSmart(d)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: "smart", id: d.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MQTT info + Setup Guide ── */}
      <div className="glass-card p-2">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="setup-guide" className="border-none">
            <AccordionTrigger className="px-3 py-2 hover:no-underline">
              <div className="flex flex-wrap items-center gap-2 text-left">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <p className="font-display font-semibold text-sm">{t("smartMeter.howtoTitle")}</p>
                {mqttInfo && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${mqttInfo.mqtt_connected ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}
                  >
                    MQTT: {mqttInfo.mqtt_connected ? "Connected" : "Disconnected"}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="space-y-4">
                {/* MQTT Broker Info */}
                {mqttInfo && (
                  <div className="rounded-xl bg-accent/30 p-3">
                    <p className="text-xs font-medium mb-1">{t("meters.mqttSetup")}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>{t("meters.mqttBroker")}: <code className="bg-muted px-1 py-0.5 rounded">{(mqttInfo as any).mqtt_broker_host || "mosquitto"}:{(mqttInfo as any).mqtt_broker_port || 1883}</code></span>
                      <span>MQTT: <Badge variant="outline" className={`text-[10px] ${mqttInfo.mqtt_connected ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}>{mqttInfo.mqtt_connected ? "Connected" : "Disconnected"}</Badge></span>
                    </div>
                    {(mqttInfo as any).mqtt_topic_prefix && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t("meters.mqttTopicPrefix")}: <code className="bg-muted px-1 py-0.5 rounded">{(mqttInfo as any).mqtt_topic_prefix}</code>
                      </p>
                    )}
                  </div>
                )}

                {/* Webhook URL */}
                <div className="rounded-xl bg-accent/30 p-3">
                  <p className="text-xs font-medium mb-1">{t("smartMeter.webhookUrl")}</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block font-mono break-all">
                    POST {window.location.origin}/api/webhooks/generic
                  </code>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{t("smartMeter.webhookUrlDesc")}</p>
                </div>

                {/* Canonical payload */}
                <div className="rounded-xl bg-accent/30 p-3">
                  <p className="text-xs font-medium mb-1">Ajánlott telemetry payload</p>
                  <pre className="text-[11px] bg-muted px-2 py-1.5 rounded font-mono overflow-x-auto">
{`{
  "device_id": "electricity-main",
  "timestamp": "2026-02-23T19:00:00Z",
  "power_w": 532,
  "energy_kwh_total": 1243.6
}`}
                  </pre>
                </div>

                {/* ESP32 MQTT example */}
                <div className="rounded-xl bg-accent/30 p-3">
                  <p className="text-xs font-medium mb-1">ESP32 Arduino MQTT</p>
                  <pre className="text-[11px] bg-muted px-2 py-1.5 rounded font-mono overflow-x-auto">
{`#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient wc;
PubSubClient mqtt(wc);

void setup() {
  WiFi.begin("SSID", "PASS");
  mqtt.setServer("${(mqttInfo as any)?.mqtt_broker_host || "192.168.x.x"}", ${(mqttInfo as any)?.mqtt_broker_port || 1883});
}

void loop() {
  mqtt.connect("esp32-meter");
  mqtt.publish(
    "rpallagi/property-${propertyId}/unit-main/electricity-main/telemetry",
    "{"timestamp":"2026-02-23T19:00:00Z","power_w":532,"energy_kwh_total":1243.6}"
  );
  delay(60000); // 1 perc
}`}
                  </pre>
                </div>

                {/* Zigbee2MQTT example */}
                <div className="rounded-xl bg-accent/30 p-3">
                  <p className="text-xs font-medium mb-1">Zigbee2MQTT topic minta</p>
                  <pre className="text-[11px] bg-muted px-2 py-1.5 rounded font-mono overflow-x-auto">
{`Topic: zigbee2mqtt/<friendly_name>
Payload: {"energy": 12345.67, "power": 150}

value_field = "energy"
multiplier = 1.0`}
                  </pre>
                </div>

                {/* Home Assistant example */}
                <div className="rounded-xl bg-accent/30 p-3">
                  <p className="text-xs font-medium mb-1">Home Assistant REST command</p>
                  <pre className="text-[11px] bg-muted px-2 py-1.5 rounded font-mono overflow-x-auto">
{`rest_command:
  send_meter:
    url: "${window.location.origin}/api/webhooks/generic"
    method: POST
    headers:
      Authorization: "Bearer YOUR_TOKEN"
      Content-Type: "application/json"
    payload: >
      {"device_id":"ha-gas-meter",
       "energy_m3_total":"{{ states('sensor.gas_meter') }}"}`}
                  </pre>
                </div>

                {/* AI Chat inline */}
                <AiChat
                  topic="smart-meter"
                  title={t("ai.smartMeterTitle")}
                  placeholder={t("ai.smartMeterPlaceholder")}
                  mode="inline"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Home Assistant bulk import dialog */}
      <Dialog open={haImportOpen} onOpenChange={setHaImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("meters.haImportTitle")}</DialogTitle>
            <DialogDescription>{t("meters.haImportDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {haSetupOpen && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-3">
                <p className="text-sm font-medium">{t("meters.haSetupInlineTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("meters.haSetupInlineDesc")}</p>
                <p className="text-[11px] text-muted-foreground">{t("meters.haSetupScopeHint")}</p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t("meters.haProfileName")}</label>
                  <Input
                    value={haSetupName}
                    onChange={(e) => setHaSetupName(e.target.value)}
                    placeholder={t("meters.haProfileNamePlaceholder")}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t("meters.haProfileLocation")}</label>
                  <Input
                    value={haSetupLocation}
                    onChange={(e) => setHaSetupLocation(e.target.value)}
                    placeholder={t("meters.haProfileLocationPlaceholder")}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t("settings.haBaseUrl")}</label>
                  <Input
                    value={haSetupUrl}
                    onChange={(e) => setHaSetupUrl(e.target.value)}
                    placeholder={t("settings.haBaseUrlPlaceholder")}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t("settings.haToken")}</label>
                  <Input
                    type="text"
                    autoComplete="off"
                    value={haSetupToken}
                    onChange={(e) => setHaSetupToken(e.target.value)}
                    placeholder={t("settings.haTokenPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">{t("meters.haProfileLocalUser")}</label>
                    <Input
                      value={haSetupLocalUser}
                      onChange={(e) => setHaSetupLocalUser(e.target.value)}
                      placeholder={t("meters.haProfileLocalUserPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">{t("meters.haProfileLocalPassword")}</label>
                    <Input
                      type="text"
                      autoComplete="off"
                      value={haSetupLocalPassword}
                      onChange={(e) => setHaSetupLocalPassword(e.target.value)}
                      placeholder={t("meters.haProfileLocalPasswordPlaceholder")}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{t("settings.haTokenHowto")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={saveHaSetupFromDialog} disabled={haSetupSaving}>
                    {haSetupSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    {t("common.save")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={testHaSetupFromDialog} disabled={haSetupTesting || !haSetupUrl.trim() || !haSetupToken.trim()}>
                    {haSetupTesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    {t("settings.haTest")}
                  </Button>
                </div>
                {haSetupStatus && (
                  <p className={`text-xs ${haSetupStatus.ok ? "text-green-600" : "text-destructive"}`}>{haSetupStatus.msg}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {t("meters.haImportFound").replace("{count}", String(haImportEntities.length))}
              </p>
              <Button variant="outline" size="sm" onClick={loadHaImportEntities} disabled={haImportLoading}>
                {haImportLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                {t("meters.haLoadEntities")}
              </Button>
            </div>

            {haImportEntities.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2">
                  <Input
                    value={haImportSearch}
                    onChange={(e) => setHaImportSearch(e.target.value)}
                    placeholder={t("meters.haImportSearchPlaceholder")}
                  />
                  <Select value={haImportUtilityFilter} onValueChange={(value) => setHaImportUtilityFilter(value as "all" | UtilityType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("common.all")}</SelectItem>
                      <SelectItem value="gaz">{t("common.gaz")}</SelectItem>
                      <SelectItem value="viz">{t("common.viz")}</SelectItem>
                      <SelectItem value="villany">{t("common.villany")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {t("meters.haImportSelected")
                      .replace("{selected}", String(selectedFilteredHaImportCount))
                      .replace("{count}", String(filteredHaImportEntities.length))}
                    <span className="ml-2">{t("meters.haImportSelectedTotal").replace("{count}", String(selectedHaImportCount))}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllHaImportEntities}>
                      {t("meters.haSelectAll")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={selectNumericHaImportEntities}>
                      {t("meters.haSelectNumeric")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearHaImportSelection}>
                      {t("meters.haDeselectAll")}
                    </Button>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-xl border p-3 space-y-2 bg-accent/20">
              <p className="text-xs font-medium">{t("meters.haBackfillTitle")}</p>
              <p className="text-[11px] text-muted-foreground">{t("meters.haBackfillDesc")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={haBackfillMonths}
                  onChange={(e) => setHaBackfillMonths(e.target.value)}
                  className="w-28 h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => runHaMonthlyBackfill(false)} disabled={haBackfillRunning}>
                  {haBackfillRunning ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  {t("meters.haBackfillRun")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => runHaMonthlyBackfill(true)} disabled={haBackfillRunning}>
                  {haBackfillRunning ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  {t("meters.haBackfillRunAll")}
                </Button>
              </div>
            </div>

            {haImportEntities.length > 0 && (
              <div className="rounded-xl border p-2 max-h-80 overflow-y-auto space-y-1">
                {filteredHaImportEntities.map((entity) => (
                  <label key={entity.entity_id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/40">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={Boolean(haImportSelected[entity.entity_id])}
                      onChange={(e) => setHaImportSelected((prev) => ({ ...prev, [entity.entity_id]: e.target.checked }))}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{entity.friendly_name || entity.entity_id}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {entity.entity_id} · {utilityLabel(entity.utility_type)} · {entity.state}{entity.unit ? ` ${entity.unit}` : ""}
                      </p>
                    </div>
                  </label>
                ))}
                {filteredHaImportEntities.length === 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">{t("meters.haImportNoResults")}</p>
                )}
              </div>
            )}

            {haImportResult && (
              <div className="rounded-lg border bg-accent/30 px-3 py-2 text-sm">
                {t("meters.haImportResult")
                  .replace("{created}", String(haImportResult.created))
                  .replace("{verified}", String(haImportResult.verified))
                  .replace("{failed}", String(haImportResult.failed))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHaImportOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={runHaImport} disabled={haImportSaving || haImportLoading} className="gradient-primary-bg border-0">
              {haImportSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {haImportSaving ? t("common.saving") : t("meters.haImportRun")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════ */}
      {/* WIZARD DIALOG                            */}
      {/* ════════════════════════════════════════ */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("meters.wizardTitle")}</DialogTitle>
            <DialogDescription>
              {wiz.step === 1 && t("meters.step1Desc")}
              {wiz.step === 2 && t("meters.step2Desc")}
              {wiz.step === 3 && wiz.meterKind === "manual" && t("meters.step3ManualDesc")}
              {wiz.step === 3 && wiz.meterKind === "smart" && t("meters.step3SmartDesc")}
              {wiz.step === 4 && wiz.meterKind === "manual" && t("meters.step4ReadingDesc")}
              {wiz.step === 4 && wiz.meterKind === "smart" && t("meters.step4SmartDesc")}
              {wiz.step === 5 && t("meters.step5Desc")}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-1 px-2">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= wiz.step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>

          <div className="py-2 space-y-4">
            {/* ── Step 1: Utility type ── */}
            {wiz.step === 1 && (
              <div className="grid grid-cols-3 gap-3">
                {([["villany", Zap, "text-yellow-500", "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"],
                   ["viz", Droplets, "text-blue-500", "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"],
                   ["gaz", Flame, "text-orange-500", "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800"]] as const).map(([type, Icon, iconCls, cardCls]) => (
                  <button
                    key={type}
                    onClick={() => { setW("utilityType", type); setW("step", 2); }}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 ${
                      wiz.utilityType === type ? `${cardCls} border-primary` : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`h-8 w-8 ${iconCls}`} />
                    <span className="font-display font-semibold text-sm">{utilityLabel(type)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Step 2: Meter kind ── */}
            {wiz.step === 2 && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setW("meterKind", "manual"); setW("step", 3); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary/50 transition-all hover:scale-105 active:scale-95"
                >
                  <ClipboardList className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-display font-semibold">{t("meters.typeManual")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("meters.typeManualDesc")}</p>
                  </div>
                </button>
                <button
                  onClick={() => { setW("meterKind", "smart"); setW("step", 3); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary/50 transition-all hover:scale-105 active:scale-95"
                >
                  <Radio className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-display font-semibold">{t("meters.typeSmart")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("meters.typeSmartDesc")}</p>
                  </div>
                </button>
              </div>
            )}

            {/* ── Step 3: Manual → serial + location ── */}
            {wiz.step === 3 && wiz.meterKind === "manual" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t("meters.serialNumber")}</label>
                  <Input value={wiz.serialNumber} onChange={e => setW("serialNumber", e.target.value)} placeholder="pl. W12345678" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t("meters.location")}</label>
                  <Input value={wiz.location} onChange={e => setW("location", e.target.value)} placeholder="pl. Előszoba, mérőszekrény" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t("meter.notes")} ({t("common.optional")})</label>
                  <Input value={wiz.notes} onChange={e => setW("notes", e.target.value)} />
                </div>
              </div>
            )}

            {/* ── Step 3: Smart → preset selection ── */}
            {wiz.step === 3 && wiz.meterKind === "smart" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 p-3">
                  <p className="text-sm font-semibold mb-1">{t("meters.haRecommendedTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("meters.haRecommendedDesc")}
                  </p>
                </div>

                <button
                  onClick={() => { applyPreset("ha"); setW("step", 4); }}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{t("meters.haPresetTitle")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("meters.haPresetDesc")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">{t("meters.haRecommendedBadge")}</Badge>
                </button>

                <button
                  onClick={async () => { setWizardOpen(false); await openHaImportDialog(); }}
                  className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/20 transition-all text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{t("meters.haImportButton")}</p>
                      <p className="text-[11px] text-muted-foreground">{t("meters.haImportDesc")}</p>
                    </div>
                  </div>
                </button>

                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowOtherSmartPresets(v => !v)}>
                    {showOtherSmartPresets ? t("meters.haHideAdvancedPresets") : t("meters.haShowAdvancedPresets")}
                  </Button>
                </div>

                {showOtherSmartPresets && (
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["esp32_mqtt", "ESP32 MQTT", Radio, "WiFi + MQTT"],
                      ["zigbee2mqtt", "Zigbee2MQTT", Activity, "Zigbee hub"],
                      ["shelly_mqtt", "Shelly MQTT", Activity, "Shelly MQTT"],
                      ["esp32_http", "ESP32 HTTP", Globe, "WiFi + HTTP"],
                      ["shelly_http", "Shelly HTTP", Globe, "Shelly HTTP"],
                      ["homewizard", "HomeWizard P1", Globe, "P1 meter"],
                      ["custom", t("smartMeter.presetCustom"), Gauge, t("smartMeter.presetCustom")],
                    ] as [PresetKey, string, any, string][]).map(([key, label, Icon, desc]) => (
                      <button
                        key={key}
                        onClick={() => { applyPreset(key); setW("step", 4); }}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:border-primary/50 transition-all text-left hover:scale-[1.02] active:scale-95"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{label}</p>
                          <p className="text-[11px] text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Manual → photo + OCR or manual entry ── */}
            {wiz.step === 4 && wiz.meterKind === "manual" && (
              <div className="space-y-4">
                <h4 className="font-display font-semibold text-sm">{t("meters.step4ReadingTitle")}</h4>

                {/* Photo area */}
                <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
                  {wiz.photo ? (
                    <div className="space-y-3">
                      <img
                        src={URL.createObjectURL(wiz.photo)}
                        alt="Meter"
                        className="max-h-40 mx-auto rounded-xl object-contain"
                      />
                      {wiz.ocrRunning && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("meters.ocrProcessing")}
                        </div>
                      )}
                      {wiz.ocrValue !== null && !wiz.ocrRunning && (
                        <div className="flex items-center justify-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-semibold">{wiz.ocrValue} {utilityUnit(wiz.utilityType)}</span>
                          <Badge variant="outline" className="text-[10px]">{t("meters.ocrConfidence")}: {wiz.ocrConfidence}</Badge>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => { setW("photo", null); setW("ocrValue", null); }}>
                        <X className="h-3.5 w-3.5 mr-1" /> {t("common.delete")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Camera className="h-10 w-10 text-muted-foreground mx-auto" />
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-3.5 w-3.5 mr-1.5" /> {t("meters.choosePhoto")}
                        </Button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => { if (e.target.files?.[0]) handlePhoto(e.target.files[0]); }}
                      />
                    </div>
                  )}
                </div>

                {/* Manual reading input */}
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t("meters.initialReading")} ({utilityUnit(wiz.utilityType)})</label>
                  <Input
                    type="number"
                    step="any"
                    value={wiz.initialReading}
                    onChange={e => setW("initialReading", e.target.value)}
                    placeholder="pl. 12345.67"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{t("meters.skipPhoto")}</p>
                </div>
              </div>
            )}

            {/* ── Step 4: Smart → device configuration ── */}
            {wiz.step === 4 && wiz.meterKind === "smart" && (
              <div className="space-y-4">
                {isHaSimpleFlow && (
                  <div className="rounded-xl border bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 text-sm">
                    <p className="font-semibold mb-1">{t("meters.haQuickSetupTitle")}</p>
                    <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
                      <li>{t("meters.haQuickSetupStep1")}</li>
                      <li>{t("meters.haQuickSetupStep2")}</li>
                      <li>{t("meters.haQuickSetupStep3")}</li>
                    </ol>
                  </div>
                )}
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.name")}</label>
                  <Input value={wiz.smartName} onChange={e => setW("smartName", e.target.value)} placeholder={t("smartMeter.namePlaceholder")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.deviceId")} *</label>
                    <Input value={wiz.smartDeviceId} onChange={e => setW("smartDeviceId", e.target.value)} placeholder="esp32-gas-01" required />
                    {isHaSimpleFlow && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t("meters.haAutoDeviceHint")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.source")}</label>
                    {isHaSimpleFlow ? (
                      <div className="h-10 px-3 rounded-md border bg-muted/40 text-sm flex items-center">
                        {t("meters.haFixedSource")}
                      </div>
                    ) : (
                      <Select value={wiz.smartSource} onValueChange={v => setW("smartSource", v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">HTTP Webhook</SelectItem>
                          <SelectItem value="mqtt">MQTT</SelectItem>
                          <SelectItem value="ttn">TTN (LoRaWAN)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                {wiz.smartSource === "mqtt" && !isHaSimpleFlow && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-muted-foreground block">{t("smartMeter.mqttTopic")}</label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setW("smartMqttTopic", suggestedTopicForDevice(wiz.smartDeviceId))}
                      >
                        {t("meters.recommendedTopic")}
                      </Button>
                    </div>
                    <Input value={wiz.smartMqttTopic} onChange={e => setW("smartMqttTopic", e.target.value)} placeholder="rpallagi/property-12/unit-main/electricity-main/telemetry" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t("meters.recommendedFormat")}: <code className="bg-muted px-1 py-0.5 rounded">{suggestedTopicForDevice(wiz.smartDeviceId || "meter-01")}</code>
                    </p>
                  </div>
                )}
                {wiz.smartSource === "ttn" && !isHaSimpleFlow && (
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.ttnAppId")}</label>
                    <Input value={wiz.smartTtnAppId} onChange={e => setW("smartTtnAppId", e.target.value)} placeholder="my-ttn-app" />
                  </div>
                )}
                {(wiz.smartSource === "http" || isHaSimpleFlow) && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-muted-foreground block">{t("smartMeter.httpToken")}</label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setW("smartTtnAppId", generateApiToken())}>
                        {t("meters.newToken")}
                      </Button>
                    </div>
                    <Input value={wiz.smartTtnAppId} onChange={e => setW("smartTtnAppId", e.target.value)} placeholder="my-secret-token" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {isHaSimpleFlow
                        ? t("meters.haTokenHint")
                        : t("smartMeter.httpTokenHint")}
                    </p>
                  </div>
                )}
                {isHaSimpleFlow && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm text-muted-foreground block">{t("meters.haEntityId")} *</label>
                      <Button type="button" variant="outline" size="sm" onClick={loadHaEntitiesForWizard} disabled={haEntityLoading}>
                        {haEntityLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                        {t("meters.haLoadEntities")}
                      </Button>
                    </div>
                    <div className="flex">
                      <div className="h-10 px-3 rounded-l-md border border-r-0 bg-muted/40 text-sm text-muted-foreground flex items-center">
                        sensor.
                      </div>
                      <Input
                        value={haEntitySuffix(wiz.smartHaEntityId)}
                        onChange={e => setW("smartHaEntityId", normalizeHaEntityId(e.target.value))}
                        placeholder={t("meters.haEntityPlaceholderSuffix")}
                        className="rounded-l-none"
                      />
                    </div>
                    {haEntityOptions.length > 0 && (
                      <div className="mt-2">
                        <Select
                          value={normalizeHaEntityId(wiz.smartHaEntityId)}
                          onValueChange={(v) => setW("smartHaEntityId", normalizeHaEntityId(v))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("meters.haSelectEntity")} />
                          </SelectTrigger>
                          <SelectContent>
                            {haEntityOptions.map((entity) => (
                              <SelectItem key={entity.entity_id} value={entity.entity_id}>
                                {entity.friendly_name || entity.entity_id} ({entity.entity_id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {haEntityError && <p className="text-[11px] text-destructive mt-1">{haEntityError}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t("meters.haEntityExamples")}: <code className="bg-muted px-1 py-0.5 rounded">sensor.p1_meter_energy_import</code>,{" "}
                      <code className="bg-muted px-1 py-0.5 rounded">sensor.gas_meter_gas_total_consumption</code>
                    </p>
                  </div>
                )}

                {isHaSimpleFlow && isValidHaEntity(wiz.smartHaEntityId) && (
                  <div className="rounded-xl bg-accent/30 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-medium">{t("meters.haExampleTitle")}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => copyToClipboard(haYamlSnippet)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> {t("meters.haCopy")}
                      </Button>
                    </div>
                    <pre className="text-[11px] bg-muted px-2 py-1.5 rounded font-mono overflow-x-auto">
{haYamlSnippet}
                    </pre>
                    <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-2">
                      <p className="text-[11px] font-medium mb-1">{t("meters.haTroubleshootTitle")}</p>
                      <ul className="list-disc ml-4 text-[11px] text-muted-foreground space-y-1">
                        <li>{t("meters.haTroubleshootUnknownDevice")}</li>
                        <li>{t("meters.haTroubleshootInvalidToken")}</li>
                        <li>{t("meters.haTroubleshootNoData")}</li>
                      </ul>
                    </div>
                  </div>
                )}

                {isHaSimpleFlow && (
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvancedSmart(v => !v)}>
                      {showAdvancedSmart ? t("meters.haAdvancedHide") : t("meters.haAdvancedShow")}
                    </Button>
                  </div>
                )}

                {(!isHaSimpleFlow || showAdvancedSmart) && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.valueField")}</label>
                        <Input value={wiz.smartValueField} onChange={e => setW("smartValueField", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.multiplier")}</label>
                        <Input type="number" step="any" value={wiz.smartMultiplier} onChange={e => setW("smartMultiplier", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.offset")}</label>
                        <Input type="number" step="any" value={wiz.smartOffset} onChange={e => setW("smartOffset", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.minInterval")}</label>
                      <Input type="number" value={wiz.smartMinInterval} onChange={e => setW("smartMinInterval", e.target.value)} min={1} />
                      <p className="text-[11px] text-muted-foreground mt-1">{t("smartMeter.minIntervalHint")}</p>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-3">
                  <Switch checked={wiz.smartIsActive} onCheckedChange={v => setW("smartIsActive", v)} />
                  <label className="text-sm">{t("smartMeter.active")}</label>
                </div>
              </div>
            )}

            {/* ── Step 5: Summary ── */}
            {wiz.step === 5 && (
              <div className="space-y-3 rounded-xl bg-accent/30 p-4">
                <div className="flex items-center gap-2">
                  {utilityIcon(wiz.utilityType)}
                  <span className="font-display font-bold">{utilityLabel(wiz.utilityType)}</span>
                  <Badge variant="outline" className="text-[10px]">{wiz.meterKind === "manual" ? t("meters.typeManual") : t("meters.typeSmart")}</Badge>
                </div>
                {wiz.meterKind === "manual" ? (
                  <div className="space-y-1 text-sm">
                    {wiz.serialNumber && <p>{t("meters.serialNumber")}: <strong>{wiz.serialNumber}</strong></p>}
                    {wiz.location && <p>{t("meters.location")}: <strong>{wiz.location}</strong></p>}
                    {wiz.initialReading && <p>{t("meters.readingValue")}: <strong>{wiz.initialReading} {utilityUnit(wiz.utilityType)}</strong></p>}
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    {wiz.smartName && <p>{t("smartMeter.name")}: <strong>{wiz.smartName}</strong></p>}
                    <p>{t("smartMeter.deviceId")}: <strong>{wiz.smartDeviceId}</strong></p>
                    <p>{t("smartMeter.source")}: <strong>{wiz.smartSource.toUpperCase()}</strong></p>
                    {wiz.smartMqttTopic && <p>{t("smartMeter.mqttTopic")}: <code className="bg-muted px-1 rounded">{wiz.smartMqttTopic}</code></p>}
                    {isHaSimpleFlow && wiz.smartHaEntityId && <p>{t("meters.haEntityId")}: <strong>{normalizeHaEntityId(wiz.smartHaEntityId)}</strong></p>}
                    <p>{t("smartMeter.valueField")}: <strong>{wiz.smartValueField}</strong></p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wizard footer */}
          <DialogFooter className="flex justify-between">
            <div>
              {wiz.step > 1 && (
                <Button variant="ghost" onClick={() => setW("step", (wiz.step - 1) as WizardStep)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> {t("common.back")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setWizardOpen(false)}>{t("common.cancel")}</Button>
              {/* Next from step 3 manual → step 4 */}
              {wiz.step === 3 && wiz.meterKind === "manual" && (
                <Button onClick={() => setW("step", 4)} className="gradient-primary-bg border-0">
                  {t("common.next")} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {/* Next from step 4 → step 5 */}
              {wiz.step === 4 && (
                <Button
                  onClick={() => setW("step", 5)}
                  disabled={wiz.meterKind === "smart" && (
                    !wiz.smartDeviceId.trim() ||
                    (isHaSimpleFlow && (!wiz.smartTtnAppId.trim() || !isValidHaEntity(wiz.smartHaEntityId)))
                  )}
                  className="gradient-primary-bg border-0"
                >
                  {t("common.next")} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {/* Save at step 5 */}
              {wiz.step === 5 && (
                <Button onClick={saveWizard} disabled={wizSaving} className="gradient-primary-bg border-0">
                  {wizSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  {wizSaving ? t("common.saving") : t("common.save")}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════ */}
      {/* EDIT PHYSICAL METER DIALOG              */}
      {/* ════════════════════════════════════════ */}
      <Dialog open={editPhysicalOpen} onOpenChange={setEditPhysicalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t("meter.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.utilityType")}</label>
              <Select value={physForm.utility_type} onValueChange={v => setPhysForm(f => ({ ...f, utility_type: v as UtilityType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="villany">{t("common.villany")}</SelectItem>
                  <SelectItem value="viz">{t("common.viz")}</SelectItem>
                  <SelectItem value="gaz">{t("common.gaz")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("meter.serialNumber")}</label>
              <Input value={physForm.serial_number} onChange={e => setPhysForm(f => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("meter.location")}</label>
              <Input value={physForm.location} onChange={e => setPhysForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("meter.notes")}</label>
              <Input value={physForm.notes} onChange={e => setPhysForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhysicalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={savePhysical} className="gradient-primary-bg border-0">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════ */}
      {/* EDIT SMART METER DIALOG                 */}
      {/* ════════════════════════════════════════ */}
      <Dialog open={editSmartOpen} onOpenChange={setEditSmartOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("smartMeter.editDevice")}</DialogTitle>
            <DialogDescription>{t("smartMeter.editDeviceDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.name")}</label>
              <Input value={smartForm.name} onChange={e => setSmartForm(f => ({ ...f, name: e.target.value }))} placeholder={t("smartMeter.namePlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.deviceId")} *</label>
                <Input value={smartForm.device_id} onChange={e => setSmartForm(f => ({ ...f, device_id: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.source")}</label>
                <Select value={smartForm.source} onValueChange={v => setSmartForm(f => ({ ...f, source: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP Webhook</SelectItem>
                    <SelectItem value="mqtt">MQTT</SelectItem>
                    <SelectItem value="ttn">TTN (LoRaWAN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.utilityType")}</label>
              <Select value={smartForm.utility_type} onValueChange={v => setSmartForm(f => ({ ...f, utility_type: v as UtilityType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="villany">{t("common.villany")}</SelectItem>
                  <SelectItem value="viz">{t("common.viz")}</SelectItem>
                  <SelectItem value="gaz">{t("common.gaz")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {smartForm.source === "mqtt" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-muted-foreground block">{t("smartMeter.mqttTopic")}</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSmartForm(f => ({ ...f, mqtt_topic: suggestedTopicForDevice(f.device_id) }))}
                  >
                    Ajánlott topic
                  </Button>
                </div>
                <Input value={smartForm.mqtt_topic} onChange={e => setSmartForm(f => ({ ...f, mqtt_topic: e.target.value }))} placeholder="rpallagi/property-12/unit-main/electricity-main/telemetry" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Javasolt forma: <code className="bg-muted px-1 py-0.5 rounded">{suggestedTopicForDevice(smartForm.device_id || "meter-01")}</code>
                </p>
              </div>
            )}
            {smartForm.source === "ttn" && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.ttnAppId")}</label>
                <Input value={smartForm.ttn_app_id} onChange={e => setSmartForm(f => ({ ...f, ttn_app_id: e.target.value }))} />
              </div>
            )}
            {smartForm.source === "http" && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.httpToken")}</label>
                <Input value={smartForm.ttn_app_id} onChange={e => setSmartForm(f => ({ ...f, ttn_app_id: e.target.value }))} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.valueField")}</label>
                <Input value={smartForm.value_field} onChange={e => setSmartForm(f => ({ ...f, value_field: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.multiplier")}</label>
                <Input type="number" step="any" value={smartForm.multiplier} onChange={e => setSmartForm(f => ({ ...f, multiplier: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.offset")}</label>
                <Input type="number" step="any" value={smartForm.offset} onChange={e => setSmartForm(f => ({ ...f, offset: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.minInterval")}</label>
              <Input type="number" value={smartForm.min_interval_minutes} onChange={e => setSmartForm(f => ({ ...f, min_interval_minutes: e.target.value }))} min={1} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={smartForm.is_active} onCheckedChange={v => setSmartForm(f => ({ ...f, is_active: v }))} />
              <label className="text-sm">{t("smartMeter.active")}</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSmartOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveSmart} disabled={smartFormSaving || !smartForm.device_id.trim()} className="gradient-primary-bg border-0">
              {smartFormSaving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("smartMeter.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Logs Viewer ── */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{t("smartMeter.logs")} &mdash; {logsName}</DialogTitle>
            <DialogDescription>{t("smartMeter.logsDesc")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[55vh] space-y-2 py-2">
            {logsLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("smartMeter.noLogs")}</p>
              </div>
            ) : logs.map(log => (
              <div key={log.id} className="glass-card p-3 text-sm flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">{formatDate(log.received_at)}</span>
                    <Badge variant="outline" className={`text-[10px] ${log.status === "ok" ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}>{log.status}</Badge>
                    {sourceBadge(log.source)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
                    {log.parsed_value !== null && <span>{t("smartMeter.parsedValue")}: {log.parsed_value}</span>}
                    {log.final_value !== null && <span>{t("smartMeter.finalValue")}: {log.final_value}</span>}
                    {log.reading_id && <span className="text-muted-foreground">Reading #{log.reading_id}</span>}
                  </div>
                  {log.error_message && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>{log.error_message}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsOpen(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyMeters;
