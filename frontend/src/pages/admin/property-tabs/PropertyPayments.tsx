import { useEffect, useState } from "react";
import { CreditCard, Plus, Pencil, Trash2 } from "lucide-react";
import {
  getPropertyPayments, addPayment, editPayment, deletePayment,
  type PaymentItem,
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

const PropertyPayments = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    amount_huf: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "atutalas",
    period_from: "",
    period_to: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    getPropertyPayments(propertyId)
      .then((data) => setPayments(data.payments))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: PaymentItem) => {
    setEditingId(p.id);
    setForm({
      amount_huf: String(p.amount_huf),
      payment_date: p.payment_date,
      payment_method: p.payment_method || "atutalas",
      period_from: p.period_from || "",
      period_to: p.period_to || "",
      notes: p.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        property_id: propertyId,
        amount_huf: Number(form.amount_huf),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        period_from: form.period_from || null,
        period_to: form.period_to || null,
        notes: form.notes || null,
      };
      if (editingId) {
        await editPayment(editingId, payload);
      } else {
        await addPayment(payload);
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
      await deletePayment(id);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    }
  };

  const methodLabel = (m: string | null) => {
    if (m === 'keszpenz') return t('payments.cash');
    if (m === 'atutalas') return t('payments.transfer');
    return m || '—';
  };

  const totalPayments = payments.reduce((sum, p) => sum + p.amount_huf, 0);

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Summary + Add button */}
      <div className="flex items-center justify-between">
        <div className="glass-card p-3 px-5">
          <span className="text-xs text-muted-foreground">{t('propDetail.totalPayments')}: </span>
          <span className="font-display font-bold format-hu">{formatHuf(totalPayments)}</span>
          <span className="text-xs text-muted-foreground ml-2">({payments.length} db)</span>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t('payments.new')}
        </Button>
      </div>

      {/* Payments list */}
      {payments.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('payments.noPayments')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="glass-card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-sm format-hu">{formatHuf(p.amount_huf)}</p>
                  <Badge variant="outline" className="text-xs">{methodLabel(p.payment_method)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</p>
                {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? t('payments.editTitle') : t('payments.newTitle')}</DialogTitle>
            <DialogDescription>{editingId ? t('payments.editTitle') : t('payments.newTitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('payments.amount')} *</label>
              <Input type="number" value={form.amount_huf} onChange={(e) => set("amount_huf", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('payments.date')} *</label>
              <Input type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('payments.method')}</label>
              <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atutalas">{t('payments.transfer')}</SelectItem>
                  <SelectItem value="keszpenz">{t('payments.cash')}</SelectItem>
                  <SelectItem value="egyeb">{t('common.egyeb')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('payments.notes')}</label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.amount_huf} className="gradient-primary-bg border-0">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('payments.deleteConfirm')}</AlertDialogDescription>
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

export default PropertyPayments;
