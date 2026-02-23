import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Pencil, Trash2, MapPin, Phone, Mail, User, ChevronRight, MessageCircle, Megaphone } from "lucide-react";
import {
  getAdminProperties, addProperty, editProperty, deleteProperty,
  getAdminChatUnread, broadcastChat,
  type AdminProperty, type TariffGroupItem,
} from "@/lib/api";
import { formatHuf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

const emptyForm = {
  name: "",
  property_type: "lakas",
  address: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  monthly_rent: "",
  purchase_price: "",
  tariff_group_id: "",
  notes: "",
};

const AdminProperties = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [tariffGroups, setTariffGroups] = useState<TariffGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSelected, setBroadcastSelected] = useState<number[]>([]);
  const [broadcastSending, setBroadcastSending] = useState(false);

  const fetchUnread = () => {
    getAdminChatUnread()
      .then((data) => setUnreadCounts(data.unread || {}))
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    Promise.all([getAdminProperties(), getAdminChatUnread()])
      .then(([propData, unreadData]) => {
        setProperties(propData.properties);
        setTariffGroups(propData.tariff_groups);
        setUnreadCounts(unreadData.unread || {});
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Poll unread counts every 30s (lightweight)
  useEffect(() => {
    const iv = setInterval(fetchUnread, 30_000);
    return () => clearInterval(iv);
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        property_type: form.property_type,
        address: form.address || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        tariff_group_id: form.tariff_group_id ? Number(form.tariff_group_id) : null,
        notes: form.notes || null,
      };
      if (editingId) {
        await editProperty(editingId, payload);
      } else {
        await addProperty(payload);
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteProperty(deleteId);
      setDeleteId(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    }
  };

  const typeBadgeClickable = (type: string, active: boolean) => {
    const base = "text-xs cursor-pointer transition-all";
    if (type === "lakas")
      return <Badge variant="outline" className={`bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 ${base} ${active ? 'ring-2 ring-blue-400 ring-offset-1' : 'hover:ring-1 hover:ring-blue-300'}`}>{t('common.lakas')}</Badge>;
    if (type === "uzlet")
      return <Badge variant="outline" className={`bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 ${base} ${active ? 'ring-2 ring-amber-400 ring-offset-1' : 'hover:ring-1 hover:ring-amber-300'}`}>{t('common.uzlet')}</Badge>;
    return <Badge variant="outline" className={`${base} ${active ? 'ring-2 ring-gray-400 ring-offset-1' : 'hover:ring-1 hover:ring-gray-300'}`}>{t('common.egyeb')}</Badge>;
  };

  const typeBadge = (type: string) => {
    if (type === "lakas")
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 text-xs">{t('common.lakas')}</Badge>;
    if (type === "uzlet")
      return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-xs">{t('common.uzlet')}</Badge>;
    return <Badge variant="outline" className="text-xs">{t('common.egyeb')}</Badge>;
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  // Filter properties by type
  const filteredProperties = filterType === "all"
    ? properties
    : properties.filter(p => p.property_type === filterType);

  // Count by type
  const countByType = {
    all: properties.length,
    lakas: properties.filter(p => p.property_type === "lakas").length,
    uzlet: properties.filter(p => p.property_type === "uzlet").length,
    egyeb: properties.filter(p => p.property_type === "egyeb").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('props.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{filteredProperties.length} {t('props.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setBroadcastSelected(properties.map(p => p.id)); setBroadcastMsg(""); setBroadcastOpen(true); }}>
            <Megaphone className="h-4 w-4 mr-2" /> {t('chat.broadcast')}
          </Button>
          <Button onClick={openNew} className="gradient-primary-bg border-0">
            <Plus className="h-4 w-4 mr-2" /> {t('props.new')}
          </Button>
        </div>
      </div>

      {/* Type filter badges */}
      <div className="flex flex-wrap gap-2 animate-in-delay-1">
        <button onClick={() => setFilterType("all")}>
          <Badge variant={filterType === "all" ? "default" : "outline"} className="text-xs cursor-pointer">
            {t('props.filterAll')} ({countByType.all})
          </Badge>
        </button>
        {countByType.lakas > 0 && (
          <button onClick={() => setFilterType(filterType === "lakas" ? "all" : "lakas")}>
            {typeBadgeClickable("lakas", filterType === "lakas")}
          </button>
        )}
        {countByType.uzlet > 0 && (
          <button onClick={() => setFilterType(filterType === "uzlet" ? "all" : "uzlet")}>
            {typeBadgeClickable("uzlet", filterType === "uzlet")}
          </button>
        )}
        {countByType.egyeb > 0 && (
          <button onClick={() => setFilterType(filterType === "egyeb" ? "all" : "egyeb")}>
            {typeBadgeClickable("egyeb", filterType === "egyeb")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in-delay-2">
        {filteredProperties.map((p) => (
          <div
            key={p.id}
            className="glass-card-hover p-5 flex flex-col gap-3 cursor-pointer group"
            onClick={() => navigate(`/admin/properties/${p.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar or icon */}
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {(p as any).avatar_filename ? (
                    <img
                      src={`/uploads/${(p as any).avatar_filename}`}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-6 w-6 text-accent-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-sm">{p.name}</h3>
                    {(unreadCounts[String(p.id)] || 0) > 0 && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        <MessageCircle className="h-3 w-3" />
                        {unreadCounts[String(p.id)]}
                      </span>
                    )}
                  </div>
                  {typeBadge(p.property_type)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/properties/${p.id}?tab=basic`); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              </div>
            </div>

            <div className="space-y-1.5 text-sm text-muted-foreground">
              {p.address && (
                <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {p.address}</p>
              )}
              {p.contact_name && (
                <p className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {p.contact_name}</p>
              )}
              {p.contact_phone && (
                <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.contact_phone}</p>
              )}
              {p.contact_email && (
                <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {p.contact_email}</p>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('props.monthlyRent')}</p>
                <p className="font-display font-bold format-hu">
                  {p.monthly_rent ? formatHuf(p.monthly_rent) : "\u2014"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('props.purchasePrice')}</p>
                <p className="font-display font-bold format-hu">
                  {p.purchase_price ? formatHuf(p.purchase_price) : "\u2014"}
                </p>
              </div>
            </div>

            {p.tariff_group_name && (
              <p className="text-xs text-muted-foreground">
                {t('props.tariffGroup')}: <span className="font-medium text-foreground">{p.tariff_group_name}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit Dialog (only used for NEW property now; edit goes to detail page) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? t('props.editTitle') : t('props.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingId ? t('props.editTitle') : t('props.newTitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('props.name')} *</label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t('props.addressPlaceholder')} />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('props.type')}</label>
              <Select value={form.property_type} onValueChange={(v) => set("property_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lakas">{t('common.lakas')}</SelectItem>
                  <SelectItem value="uzlet">{t('common.uzlet')}</SelectItem>
                  <SelectItem value="egyeb">{t('common.egyeb')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('props.address')}</label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={t('props.address')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('props.contactName')}</label>
                <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('props.phone')}</label>
                <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('props.email')}</label>
              <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('props.monthlyRent')}</label>
                <Input type="number" value={form.monthly_rent} onChange={(e) => set("monthly_rent", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('props.purchasePrice')}</label>
                <Input type="number" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('props.tariffGroup')}</label>
              <Select value={form.tariff_group_id} onValueChange={(v) => set("tariff_group_id", v)}>
                <SelectTrigger><SelectValue placeholder={t('props.selectTariff')} /></SelectTrigger>
                <SelectContent>
                  {tariffGroups.map((tg) => (
                    <SelectItem key={tg.id} value={String(tg.id)}>{tg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('props.notes')}</label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name} className="gradient-primary-bg border-0">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t('props.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('props.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Broadcast dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Megaphone className="h-5 w-5" /> {t('chat.broadcastTitle')}
            </DialogTitle>
            <DialogDescription>{t('chat.broadcastDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Select / deselect all */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBroadcastSelected(properties.map(p => p.id))}>
                {t('chat.broadcastSelectAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBroadcastSelected([])}>
                {t('chat.broadcastSelectNone')}
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {broadcastSelected.length}/{properties.length}
              </span>
            </div>
            {/* Property checkboxes */}
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={broadcastSelected.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setBroadcastSelected(s => [...s, p.id]);
                      else setBroadcastSelected(s => s.filter(id => id !== p.id));
                    }}
                    className="rounded"
                  />
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{p.name}</span>
                  {typeBadge(p.property_type)}
                </label>
              ))}
            </div>
            {/* Message */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('chat.broadcastMessage')}</label>
              <Textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder={t('chat.broadcastMessagePlaceholder')}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={async () => {
                if (broadcastSelected.length === 0) { alert(t('chat.broadcastNoSelection')); return; }
                if (!broadcastMsg.trim()) { alert(t('chat.broadcastNoMessage')); return; }
                setBroadcastSending(true);
                try {
                  const res = await broadcastChat(broadcastSelected, broadcastMsg.trim());
                  setBroadcastOpen(false);
                  setBroadcastMsg("");
                  alert(`${t('chat.broadcastSuccess')} (${res.count} ${t('chat.broadcastSentTo')})`);
                  fetchUnread();
                } catch (e: any) {
                  alert(e.message || t('common.error'));
                } finally {
                  setBroadcastSending(false);
                }
              }}
              disabled={broadcastSending || !broadcastMsg.trim() || broadcastSelected.length === 0}
              className="gradient-primary-bg border-0"
            >
              {broadcastSending ? t('chat.broadcastSending') : t('chat.broadcastSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProperties;
