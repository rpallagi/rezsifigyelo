import { useEffect, useState } from "react";
import { Wifi, Plus, Pencil, Trash2, Eye, EyeOff, Copy, Star } from "lucide-react";
import {
  getPropertyWifi, addWifi, editWifi, deleteWifi,
  type WifiNetworkItem,
} from "@/lib/api";
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

interface Props {
  propertyId: number;
}

const emptyForm = {
  ssid: "",
  password: "",
  security_type: "WPA2",
  location: "",
  is_primary: false,
  notes: "",
};

const PropertyWifi = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [networks, setNetworks] = useState<WifiNetworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  const load = () => {
    setLoading(true);
    getPropertyWifi(propertyId)
      .then((data) => setNetworks(data.networks || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const set = (key: string, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (net: WifiNetworkItem) => {
    setEditingId(net.id);
    setForm({
      ssid: net.ssid,
      password: net.password || "",
      security_type: net.security_type || "WPA2",
      location: net.location || "",
      is_primary: net.is_primary,
      notes: net.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.ssid.trim()) {
      toast.error("SSID is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ssid: form.ssid.trim(),
        password: form.password || null,
        security_type: form.security_type,
        location: form.location.trim() || null,
        is_primary: form.is_primary,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await editWifi(editingId, payload);
      } else {
        await addWifi(propertyId, payload);
      }
      setDialogOpen(false);
      load();
      toast.success(editingId ? t("wifi.updated") : t("wifi.added"));
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteWifi(id);
      setDeleteConfirm(null);
      load();
      toast.success(t("wifi.deleted"));
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    }
  };

  const toggleShowPassword = (id: number) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, toastMsg: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(toastMsg);
    }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
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
          <span className="text-xs text-muted-foreground">{t("wifi.title")}: </span>
          <span className="font-display font-bold">{networks.length}</span>
          <span className="text-xs text-muted-foreground ml-1">{t("wifi.networks")}</span>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t("wifi.addNetwork")}
        </Button>
      </div>

      {/* Empty state */}
      {networks.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Wifi className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("wifi.noNetworks")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {networks.map((net) => (
            <div key={net.id} className="glass-card p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Wifi className="h-5 w-5 text-accent-foreground" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* SSID + badges */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className="font-display font-bold text-base truncate cursor-pointer hover:text-primary"
                      onClick={() => copyToClipboard(net.ssid, t("wifi.copySsid"))}
                      title="Click to copy"
                    >
                      {net.ssid}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                      {net.security_type}
                    </Badge>
                    {net.is_primary && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800">
                        <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                        {t("wifi.primary")}
                      </Badge>
                    )}
                  </div>

                  {/* Password */}
                  {net.password && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground">{t("wifi.password")}:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
                        {showPasswords[net.id] ? net.password : "••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleShowPassword(net.id)}
                      >
                        {showPasswords[net.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(net.password!, t("wifi.copyPassword"))}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Location + Notes */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {net.location && <span>{net.location}</span>}
                    {net.notes && <span className="italic">{net.notes}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(net)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteConfirm(net.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? t("wifi.editNetwork") : t("wifi.addNetwork")}
            </DialogTitle>
            <DialogDescription>
              {editingId ? t("wifi.editNetworkDesc") : t("wifi.addNetworkDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* SSID */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("wifi.ssid")} *
              </label>
              <Input
                value={form.ssid}
                onChange={(e) => set("ssid", e.target.value)}
                placeholder="MyHomeWiFi"
                required
              />
            </div>

            {/* Password + Security */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("wifi.password")}
                </label>
                <Input
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••"
                  type="text"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("wifi.securityType")}
                </label>
                <Select value={form.security_type} onValueChange={(v) => set("security_type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WPA2">WPA2</SelectItem>
                    <SelectItem value="WPA3">WPA3</SelectItem>
                    <SelectItem value="WPA2/WPA3">WPA2/WPA3</SelectItem>
                    <SelectItem value="WEP">WEP</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("wifi.location")}
              </label>
              <Input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder={t("wifi.locationPlaceholder")}
              />
            </div>

            {/* Primary toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_primary}
                onCheckedChange={(v) => set("is_primary", v)}
              />
              <label className="text-sm">{t("wifi.isPrimary")}</label>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("wifi.notes")}
              </label>
              <Input
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.ssid.trim()}
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
              {t("wifi.deleteConfirm")}
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
    </div>
  );
};

export default PropertyWifi;
