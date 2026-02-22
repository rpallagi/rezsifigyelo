import { useEffect, useState } from "react";
import { Wrench, Plus, Pencil, Trash2 } from "lucide-react";
import {
  getPropertyMaintenance, addMaintenance, editMaintenance, deleteMaintenance,
  type MaintenanceItem,
} from "@/lib/api";
import { formatHuf, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface Props {
  propertyId: number;
}

const PropertyMaintenance = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    description: "",
    category: "karbantartas",
    cost_huf: "",
    performed_by: "",
    performed_date: new Date().toISOString().split("T")[0],
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    getPropertyMaintenance(propertyId)
      .then((data) => setItems(data.maintenance))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: MaintenanceItem) => {
    setEditingId(m.id);
    setForm({
      description: m.description,
      category: m.category || "karbantartas",
      cost_huf: m.cost_huf != null ? String(m.cost_huf) : "",
      performed_by: m.performed_by || "",
      performed_date: m.performed_date || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        property_id: propertyId,
        description: form.description,
        category: form.category,
        cost_huf: form.cost_huf ? Number(form.cost_huf) : null,
        performed_by: form.performed_by || null,
        performed_date: form.performed_date || null,
      };
      if (editingId) {
        await editMaintenance(editingId, payload);
      } else {
        await addMaintenance(payload);
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMaintenance(id);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    }
  };

  const catLabel = (cat: string | null) => {
    const map: Record<string, string> = {
      javitas: t('maint.javitas'),
      karbantartas: t('maint.karbantartas'),
      felujitas: t('maint.felujitas'),
      csere: t('maint.csere'),
      egyeb: t('common.egyeb'),
    };
    return map[cat || ''] || cat || '—';
  };

  const totalCost = items.reduce((sum, m) => sum + (m.cost_huf || 0), 0);

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="glass-card p-3 px-5">
          <span className="text-xs text-muted-foreground">{t('propDetail.totalMaintenance')}: </span>
          <span className="font-display font-bold format-hu">{formatHuf(totalCost)}</span>
          <span className="text-xs text-muted-foreground ml-2">({items.length} db)</span>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t('maint.new')}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('maint.noItems')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="glass-card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                <Wrench className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{m.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{catLabel(m.category)}</Badge>
                  {m.performed_date && (
                    <span className="text-xs text-muted-foreground">{formatDate(m.performed_date)}</span>
                  )}
                  {m.performed_by && (
                    <span className="text-xs text-muted-foreground">· {m.performed_by}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.cost_huf != null && m.cost_huf > 0 && (
                  <p className="font-display font-bold text-sm format-hu">{formatHuf(m.cost_huf)}</p>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? t('maint.editTitle') : t('maint.newTitle')}</DialogTitle>
            <DialogDescription>{editingId ? t('maint.editTitle') : t('maint.newTitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.description')} *</label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.category')}</label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="javitas">{t('maint.javitas')}</SelectItem>
                  <SelectItem value="karbantartas">{t('maint.karbantartas')}</SelectItem>
                  <SelectItem value="felujitas">{t('maint.felujitas')}</SelectItem>
                  <SelectItem value="csere">{t('maint.csere')}</SelectItem>
                  <SelectItem value="egyeb">{t('common.egyeb')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('maint.cost')}</label>
                <Input type="number" value={form.cost_huf} onChange={(e) => set("cost_huf", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('maint.performedBy')}</label>
                <Input value={form.performed_by} onChange={(e) => set("performed_by", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.date')}</label>
              <Input type="date" value={form.performed_date} onChange={(e) => set("performed_date", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.description} className="gradient-primary-bg border-0">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('maint.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PropertyMaintenance;
