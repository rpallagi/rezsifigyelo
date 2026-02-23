import { useEffect, useState, useRef } from "react";
import {
  Gauge, Plus, Pencil, Trash2, Activity, Wifi, AlertTriangle, Globe,
  BookOpen, Zap, Droplets, Flame, ClipboardList, Radio, Camera, Upload,
  Check, ChevronRight, ArrowLeft, Loader2, X,
} from "lucide-react";
import {
  getPropertyMeters, addMeter, editMeter, deleteMeter,
  getPropertySmartMeters, addSmartMeter, editSmartMeter, deleteSmartMeter,
  getSmartMeterLogs, getSmartMeterStatus, ocrMeterPhoto, adminSubmitReading,
  type MeterInfoItem, type SmartMeterDeviceItem, type SmartMeterLogItem,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
    setWizardOpen(true);
  };

  const applyPreset = (key: PresetKey) => {
    const p = DEVICE_PRESETS[key];
    setWiz(w => ({
      ...w,
      preset: key,
      smartName: p.name,
      smartDeviceId: w.smartDeviceId || p.device_id,
      smartSource: p.source as any,
      smartValueField: p.value_field,
      smartMultiplier: p.multiplier,
      smartOffset: p.offset,
      smartMqttTopic: p.mqtt_topic,
    }));
  };

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
        await addSmartMeter(propertyId, {
          name: wiz.smartName.trim() || null,
          device_id: wiz.smartDeviceId.trim(),
          source: wiz.smartSource,
          utility_type: wiz.utilityType,
          value_field: wiz.smartValueField.trim() || "value",
          multiplier: parseFloat(wiz.smartMultiplier) || 1.0,
          offset: parseFloat(wiz.smartOffset) || 0.0,
          min_interval_minutes: parseInt(wiz.smartMinInterval, 10) || 60,
          mqtt_topic: wiz.smartSource === "mqtt" ? (wiz.smartMqttTopic.trim() || null) : null,
          ttn_app_id: wiz.smartSource === "ttn" ? (wiz.smartTtnAppId.trim() || null) : null,
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
        value_field: smartForm.value_field.trim() || "value",
        multiplier: parseFloat(smartForm.multiplier) || 1.0,
        offset: parseFloat(smartForm.offset) || 0.0,
        min_interval_minutes: parseInt(smartForm.min_interval_minutes, 10) || 60,
        mqtt_topic: smartForm.source === "mqtt" ? (smartForm.mqtt_topic.trim() || null) : null,
        ttn_app_id: smartForm.source === "ttn" ? (smartForm.ttn_app_id.trim() || null) : null,
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
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <p className="font-display font-semibold text-sm">{t("smartMeter.howtoTitle")}</p>
        </div>

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
  mqtt.publish("rezsi/esp32-gas",
    "{\\"value\\":12345.67}");
  delay(3600000); // 1 óra
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
       "value":"{{ states('sensor.gas_meter') }}"}`}
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
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["esp32_mqtt", "ESP32 MQTT", Radio, "WiFi + MQTT"],
                  ["zigbee2mqtt", "Zigbee2MQTT", Activity, "Zigbee hub"],
                  ["shelly_mqtt", "Shelly MQTT", Activity, "Shelly MQTT"],
                  ["esp32_http", "ESP32 HTTP", Globe, "WiFi + HTTP"],
                  ["ha", "Home Assistant", Globe, "HA REST"],
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
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.name")}</label>
                  <Input value={wiz.smartName} onChange={e => setW("smartName", e.target.value)} placeholder={t("smartMeter.namePlaceholder")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.deviceId")} *</label>
                    <Input value={wiz.smartDeviceId} onChange={e => setW("smartDeviceId", e.target.value)} placeholder="esp32-gas-01" required />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.source")}</label>
                    <Select value={wiz.smartSource} onValueChange={v => setW("smartSource", v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP Webhook</SelectItem>
                        <SelectItem value="mqtt">MQTT</SelectItem>
                        <SelectItem value="ttn">TTN (LoRaWAN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {wiz.smartSource === "mqtt" && (
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.mqttTopic")}</label>
                    <Input value={wiz.smartMqttTopic} onChange={e => setW("smartMqttTopic", e.target.value)} placeholder="zigbee2mqtt/gas-sensor" />
                  </div>
                )}
                {wiz.smartSource === "ttn" && (
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.ttnAppId")}</label>
                    <Input value={wiz.smartTtnAppId} onChange={e => setW("smartTtnAppId", e.target.value)} placeholder="my-ttn-app" />
                  </div>
                )}
                {wiz.smartSource === "http" && (
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.httpToken")}</label>
                    <Input value={wiz.smartTtnAppId} onChange={e => setW("smartTtnAppId", e.target.value)} placeholder="my-secret-token" />
                    <p className="text-[11px] text-muted-foreground mt-1">{t("smartMeter.httpTokenHint")}</p>
                  </div>
                )}
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
                  disabled={wiz.meterKind === "smart" && !wiz.smartDeviceId.trim()}
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
                <label className="text-sm text-muted-foreground block mb-1">{t("smartMeter.mqttTopic")}</label>
                <Input value={smartForm.mqtt_topic} onChange={e => setSmartForm(f => ({ ...f, mqtt_topic: e.target.value }))} />
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
