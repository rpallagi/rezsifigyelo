import { useEffect, useState } from "react";
import { Building2, Plus, Pencil, Trash2, MapPin, Phone, Mail, User } from "lucide-react";
import {
  getAdminProperties, addProperty, editProperty, deleteProperty,
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
  pin: "",
  notes: "",
};

const AdminProperties = () => {
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [tariffGroups, setTariffGroups] = useState<TariffGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    getAdminProperties()
      .then((data) => {
        setProperties(data.properties);
        setTariffGroups(data.tariff_groups);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: AdminProperty) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      property_type: p.property_type,
      address: p.address || "",
      contact_name: p.contact_name || "",
      contact_phone: p.contact_phone || "",
      contact_email: p.contact_email || "",
      monthly_rent: p.monthly_rent != null ? String(p.monthly_rent) : "",
      purchase_price: p.purchase_price != null ? String(p.purchase_price) : "",
      tariff_group_id: String(p.tariff_group_id),
      pin: "",
      notes: p.notes || "",
    });
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
      if (form.pin) payload.pin = form.pin;

      if (editingId) {
        await editProperty(editingId, payload);
      } else {
        await addProperty(payload);
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      alert(e.message || "Hiba történt");
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
      alert(e.message || "Hiba történt");
    }
  };

  const typeBadge = (type: string) => {
    if (type === "lakas")
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">Lakás</Badge>;
    if (type === "uzlet")
      return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">Üzlet</Badge>;
    return <Badge variant="outline" className="text-xs">Egyéb</Badge>;
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

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
          <h1 className="font-display text-2xl font-bold">Ingatlanok</h1>
          <p className="text-muted-foreground text-sm mt-1">{properties.length} ingatlan kezelése</p>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> Új ingatlan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in-delay-1">
        {properties.map((p) => (
          <div key={p.id} className="glass-card-hover p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm">{p.name}</h3>
                  {typeBadge(p.property_type)}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
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
                <p className="text-xs text-muted-foreground">Bérleti díj</p>
                <p className="font-display font-bold format-hu">
                  {p.monthly_rent ? formatHuf(p.monthly_rent) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Vételár</p>
                <p className="font-display font-bold format-hu">
                  {p.purchase_price ? formatHuf(p.purchase_price) : "—"}
                </p>
              </div>
            </div>

            {p.tariff_group_name && (
              <p className="text-xs text-muted-foreground">
                Tarifa csoport: <span className="font-medium text-foreground">{p.tariff_group_name}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Ingatlan szerkesztése" : "Új ingatlan"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Módosítsd az ingatlan adatait." : "Add meg az új ingatlan adatait."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Név *</label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="pl. Petőfi utca 12." />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Típus</label>
              <Select value={form.property_type} onValueChange={(v) => set("property_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lakas">Lakás</SelectItem>
                  <SelectItem value="uzlet">Üzlet</SelectItem>
                  <SelectItem value="egyeb">Egyéb</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Cím</label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Cím" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Kapcsolattartó neve</label>
                <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Telefonszám</label>
                <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">E-mail</label>
              <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Havi bérleti díj (Ft)</label>
                <Input type="number" value={form.monthly_rent} onChange={(e) => set("monthly_rent", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Vételár (Ft)</label>
                <Input type="number" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Tarifa csoport</label>
              <Select value={form.tariff_group_id} onValueChange={(v) => set("tariff_group_id", v)}>
                <SelectTrigger><SelectValue placeholder="Válassz..." /></SelectTrigger>
                <SelectContent>
                  {tariffGroups.map((tg) => (
                    <SelectItem key={tg.id} value={String(tg.id)}>{tg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                Bérlő PIN kód {editingId && "(hagyd üresen, ha nem változik)"}
              </label>
              <Input value={form.pin} onChange={(e) => set("pin", e.target.value)} placeholder="4-6 jegyű kód" />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Megjegyzés</label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Mégse</Button>
            <Button onClick={handleSave} disabled={saving || !form.name} className="gradient-primary-bg border-0">
              {saving ? "Mentés..." : "Mentés"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Ingatlan törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törölni szeretnéd ezt az ingatlant? Ez a művelet nem vonható vissza, és az összes kapcsolódó adat (mérőállások, befizetések) is törlődik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProperties;
