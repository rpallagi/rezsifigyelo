import { useEffect, useState } from "react";
import { Radio, Plus, Pencil, Trash2, Activity, Wifi, AlertTriangle, Globe, BookOpen, Copy, CheckCircle2, Clock } from "lucide-react";
import {
  getPropertySmartMeters, addSmartMeter, editSmartMeter, deleteSmartMeter,
  getSmartMeterLogs,
  type SmartMeterDeviceItem, type SmartMeterLogItem,
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

const DEVICE_PRESETS = {
  custom: { name: '', device_id: '', source: 'http' as const, value_field: 'value', multiplier: '1.0', offset: '0.0' },
  shelly: { name: 'Shelly 3EM Pro', device_id: 'shelly-3em-', source: 'http' as const, value_field: 'total', multiplier: '0.001', offset: '0.0' },
  homewizard: { name: 'HomeWizard P1', device_id: 'homewizard-p1-', source: 'http' as const, value_field: 'total_power_import_kwh', multiplier: '1.0', offset: '0.0' },
  esp32: { name: 'ESP32 DIY', device_id: 'esp32-', source: 'http' as const, value_field: 'value', multiplier: '1.0', offset: '0.0' },
  ha: { name: 'Home Assistant', device_id: 'ha-', source: 'http' as const, value_field: 'state', multiplier: '1.0', offset: '0.0' },
};

const emptyForm = {
  name: "",
  device_id: "",
  source: "http" as "ttn" | "mqtt" | "http",
  utility_type: "villany" as "villany" | "viz" | "gaz",
  value_field: "value",
  multiplier: "1.0",
  offset: "0.0",
  min_interval_minutes: "60",
  mqtt_topic: "",
  ttn_app_id: "",
  is_active: true,
};

const PropertySmartMeters = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [devices, setDevices] = useState<SmartMeterDeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Logs viewer state
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsDeviceId, setLogsDeviceId] = useState<number | null>(null);
  const [logsDeviceName, setLogsDeviceName] = useState("");
  const [logs, setLogs] = useState<SmartMeterLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getPropertySmartMeters(propertyId)
      .then((data) => setDevices((data as any).devices || data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const set = (key: string, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const applyPreset = (presetKey: string) => {
    const preset = DEVICE_PRESETS[presetKey as keyof typeof DEVICE_PRESETS];
    if (preset) {
      setForm(f => ({
        ...f,
        name: preset.name,
        device_id: f.device_id || preset.device_id,
        source: preset.source as any,
        value_field: preset.value_field,
        multiplier: preset.multiplier,
        offset: preset.offset,
      }));
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (device: SmartMeterDeviceItem) => {
    setEditingId(device.id);
    setForm({
      name: device.name || "",
      device_id: device.device_id,
      source: device.source as "ttn" | "mqtt" | "http",
      utility_type: device.utility_type as "villany" | "viz" | "gaz",
      value_field: device.value_field || "meter_value",
      multiplier: String(device.multiplier),
      offset: String(device.offset),
      min_interval_minutes: String(device.min_interval_minutes),
      mqtt_topic: device.mqtt_topic || "",
      ttn_app_id: device.ttn_app_id || "",
      is_active: device.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.device_id.trim()) {
      toast.error(t("smartMeter.deviceIdRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim() || null,
        device_id: form.device_id.trim(),
        source: form.source,
        utility_type: form.utility_type,
        value_field: form.value_field.trim() || "value",
        multiplier: parseFloat(form.multiplier) || 1.0,
        offset: parseFloat(form.offset) || 0.0,
        min_interval_minutes: parseInt(form.min_interval_minutes, 10) || 60,
        mqtt_topic: form.source === "mqtt" ? (form.mqtt_topic.trim() || null) : null,
        ttn_app_id: (form.source === "ttn" || form.source === "http") ? (form.ttn_app_id.trim() || null) : null,
        is_active: form.is_active,
      };
      if (editingId) {
        await editSmartMeter(editingId, payload);
      } else {
        await addSmartMeter(propertyId, payload);
      }
      setDialogOpen(false);
      load();
      toast.success(editingId ? t("smartMeter.updated") : t("smartMeter.added"));
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSmartMeter(id);
      setDeleteConfirm(null);
      load();
      toast.success(t("smartMeter.deleted"));
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    }
  };

  const handleToggleActive = async (device: SmartMeterDeviceItem) => {
    try {
      await editSmartMeter(device.id, { is_active: !device.is_active });
      load();
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    }
  };

  const openLogs = async (device: SmartMeterDeviceItem) => {
    setLogsDeviceId(device.id);
    setLogsDeviceName(device.name || device.device_id);
    setLogsDialogOpen(true);
    setLogsLoading(true);
    try {
      const data = await getSmartMeterLogs(device.id);
      setLogs((data as any).logs || data);
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const sourceBadgeClass = (source: string) => {
    if (source === "ttn") return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800";
    if (source === "http") return "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
    return "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800";
  };

  const utilityBadgeClass = (utilityType: string) => {
    if (utilityType === "villany") return "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
    if (utilityType === "gaz") return "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800";
    return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800";
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "ok":
        return "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
      case "error":
        return "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="glass-card p-3 px-5">
          <span className="text-xs text-muted-foreground">{t("smartMeter.title")}: </span>
          <span className="font-display font-bold">{devices.length}</span>
          <span className="text-xs text-muted-foreground ml-1">{t("smartMeter.devices")}</span>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t("smartMeter.addDevice")}
        </Button>
      </div>

      {/* Empty state */}
      {devices.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Radio className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("smartMeter.noDevices")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div key={device.id} className="glass-card p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                  {device.source === "ttn" ? (
                    <Wifi className="h-5 w-5 text-accent-foreground" />
                  ) : device.source === "http" ? (
                    <Globe className="h-5 w-5 text-accent-foreground" />
                  ) : (
                    <Activity className="h-5 w-5 text-accent-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Name + badges row */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-display font-bold text-base truncate">
                      {device.name || device.device_id}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${sourceBadgeClass(device.source)}`}
                    >
                      {device.source.toUpperCase()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${utilityBadgeClass(device.utility_type)}`}
                    >
                      {device.utility_type === "villany"
                        ? t("smartMeter.electricity")
                        : device.utility_type === "gaz"
                          ? t("smartMeter.gas")
                          : t("smartMeter.water")}
                    </Badge>
                    {!device.is_active && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-800"
                      >
                        {t("smartMeter.inactive")}
                      </Badge>
                    )}
                  </div>

                  {/* Device ID */}
                  {device.name && (
                    <div className="text-xs text-muted-foreground mb-1.5">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                        {device.device_id}
                      </code>
                    </div>
                  )}

                  {/* Status + Last seen + last value */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {device.last_seen_at ? (
                      <>
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("smartMeter.lastSeen")}: {formatDate(device.last_seen_at)}
                        </span>
                        {device.last_raw_value !== null && (
                          <span className="text-muted-foreground">
                            {t("smartMeter.lastValue")}: {device.last_raw_value}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 italic">
                        <Clock className="h-3 w-3" />
                        {t("smartMeter.noDataReceived")}
                      </span>
                    )}
                  </div>

                  {/* Last error */}
                  {device.last_error && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{device.last_error}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch
                    checked={device.is_active}
                    onCheckedChange={() => handleToggleActive(device)}
                    className="mr-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openLogs(device)}
                    title={t("smartMeter.logs")}
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(device)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteConfirm(device.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Webhook Info + Setup Guide */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <p className="font-display font-semibold text-sm">{t("smartMeter.howtoTitle")}</p>
        </div>

        {/* Webhook URL */}
        <div className="rounded-xl bg-accent/30 p-3">
          <p className="text-xs font-medium mb-1">{t("smartMeter.webhookUrl")}</p>
          <code className="text-xs bg-muted px-2 py-1 rounded block font-mono break-all">
            POST {window.location.origin}/api/webhooks/generic
          </code>
          <p className="text-[11px] text-muted-foreground mt-1.5">{t("smartMeter.webhookUrlDesc")}</p>
        </div>

        {/* Payload format */}
        <div className="rounded-xl bg-accent/30 p-3">
          <p className="text-xs font-medium mb-1">{t("smartMeter.webhookPayload")}</p>
          <pre className="text-[11px] bg-muted px-2 py-1.5 rounded font-mono overflow-x-auto">
{`{
  "device_id": "your-device-id",
  "value": 12345.67,
  "timestamp": "2025-01-15T10:30:00Z"
}`}
          </pre>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Header: Authorization: Bearer &lt;your-token&gt;
          </p>
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? t("smartMeter.editDevice") : t("smartMeter.addDevice")}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t("smartMeter.editDeviceDesc")
                : t("smartMeter.addDeviceDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Device Preset (only for new) */}
            {!editingId && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.devicePreset")}
                </label>
                <Select defaultValue="custom" onValueChange={applyPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{t("smartMeter.presetCustom")}</SelectItem>
                    <SelectItem value="shelly">{t("smartMeter.presetShelly")}</SelectItem>
                    <SelectItem value="homewizard">{t("smartMeter.presetHomeWizard")}</SelectItem>
                    <SelectItem value="esp32">{t("smartMeter.presetESP32")}</SelectItem>
                    <SelectItem value="ha">{t("smartMeter.presetHA")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("smartMeter.name")}
              </label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("smartMeter.namePlaceholder")}
              />
            </div>

            {/* Device ID + Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.deviceId")} *
                </label>
                <Input
                  value={form.device_id}
                  onChange={(e) => set("device_id", e.target.value)}
                  placeholder="esp32-gas-01"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.source")} *
                </label>
                <Select value={form.source} onValueChange={(v) => set("source", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP Webhook</SelectItem>
                    <SelectItem value="ttn">TTN (LoRaWAN)</SelectItem>
                    <SelectItem value="mqtt">MQTT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Utility type */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("smartMeter.utilityType")} *
              </label>
              <Select
                value={form.utility_type}
                onValueChange={(v) => set("utility_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="villany">{t("smartMeter.electricity")}</SelectItem>
                  <SelectItem value="viz">{t("smartMeter.water")}</SelectItem>
                  <SelectItem value="gaz">{t("smartMeter.gas")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* TTN App ID (only when source=ttn) */}
            {form.source === "ttn" && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.ttnAppId")}
                </label>
                <Input
                  value={form.ttn_app_id}
                  onChange={(e) => set("ttn_app_id", e.target.value)}
                  placeholder="my-ttn-app"
                />
              </div>
            )}

            {/* HTTP Webhook Setup (only when source=http) */}
            {form.source === "http" && (
              <div className="space-y-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Webhook Configuration</p>

                    {/* Webhook URL */}
                    <div className="mb-2.5">
                      <label className="text-xs text-blue-800 dark:text-blue-200 block mb-1">Webhook URL (copy to device):</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded border border-blue-300 dark:border-blue-700 p-1.5">
                        <code className="text-[11px] flex-1 break-all">{window.location.origin}/api/webhooks/generic</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/generic`);
                            toast.success("Copied!");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Auth Token */}
                    <div className="mb-2.5">
                      <label className="text-xs text-blue-800 dark:text-blue-200 block mb-1">Auth Token (Bearer header):</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded border border-blue-300 dark:border-blue-700 p-1.5">
                        <code className="text-[11px] flex-1 break-all font-mono">
                          {form.ttn_app_id || "Generate token below →"}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => {
                            if (form.ttn_app_id) {
                              navigator.clipboard.writeText(form.ttn_app_id);
                              toast.success("Token copied!");
                            }
                          }}
                          disabled={!form.ttn_app_id}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Device ID */}
                    <div className="mb-3">
                      <label className="text-xs text-blue-800 dark:text-blue-200 block mb-1">Device ID (use in JSON body):</label>
                      <code className="text-[11px] bg-white dark:bg-slate-900 rounded border border-blue-300 dark:border-blue-700 p-1.5 block break-all">
                        {form.device_id || "enter-device-id"}
                      </code>
                    </div>

                    {/* Example JSON */}
                    <div className="bg-white dark:bg-slate-900 rounded border border-blue-300 dark:border-blue-700 p-2 text-[10px] overflow-x-auto">
                      <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">JSON Body Example:</p>
                      <code className="block whitespace-pre text-slate-700 dark:text-slate-300">
{`{
  "device_id": "${form.device_id || "shelly-3em-artfactory"}",
  "value": 12345.67
}`}
                      </code>
                    </div>

                    <p className="text-[10px] text-blue-700 dark:text-blue-300 mt-2">
                      💡 Paste the Webhook URL into your device&apos;s HTTP Action settings.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* MQTT Topic (only when source=mqtt) */}
            {form.source === "mqtt" && (
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.mqttTopic")}
                </label>
                <Input
                  value={form.mqtt_topic}
                  onChange={(e) => set("mqtt_topic", e.target.value)}
                  placeholder="home/meters/water"
                />
              </div>
            )}

            {/* Value field + Multiplier + Offset */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.valueField")}
                </label>
                <Input
                  value={form.value_field}
                  onChange={(e) => set("value_field", e.target.value)}
                  placeholder="value"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.multiplier")}
                </label>
                <Input
                  type="number"
                  step="any"
                  value={form.multiplier}
                  onChange={(e) => set("multiplier", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("smartMeter.offset")}
                </label>
                <Input
                  type="number"
                  step="any"
                  value={form.offset}
                  onChange={(e) => set("offset", e.target.value)}
                />
              </div>
            </div>

            {/* Min interval */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("smartMeter.minInterval")}
              </label>
              <Input
                type="number"
                value={form.min_interval_minutes}
                onChange={(e) => set("min_interval_minutes", e.target.value)}
                min={1}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("smartMeter.minIntervalHint")}
              </p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
              <label className="text-sm">{t("smartMeter.active")}</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.device_id.trim()}
              className="gradient-primary-bg border-0"
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("smartMeter.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logs Viewer Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("smartMeter.logs")} &mdash; {logsDeviceName}
            </DialogTitle>
            <DialogDescription>{t("smartMeter.logsDesc")}</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[55vh] space-y-2 py-2">
            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("smartMeter.noLogs")}
                </p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="glass-card p-3 text-sm flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.received_at)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${statusBadgeClass(log.status)}`}
                      >
                        {log.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${sourceBadgeClass(log.source)}`}
                      >
                        {log.source.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
                      {log.parsed_value !== null && (
                        <span>
                          {t("smartMeter.parsedValue")}: {log.parsed_value}
                        </span>
                      )}
                      {log.final_value !== null && (
                        <span>
                          {t("smartMeter.finalValue")}: {log.final_value}
                        </span>
                      )}
                      {log.reading_id && (
                        <span className="text-muted-foreground">
                          Reading #{log.reading_id}
                        </span>
                      )}
                    </div>
                    {log.error_message && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        <span>{log.error_message}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertySmartMeters;
