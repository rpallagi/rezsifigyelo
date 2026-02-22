import { useEffect, useState, useRef } from "react";
import { Landmark, Plus, Pencil, Trash2, Copy, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  getPropertyTaxes, addPropertyTax, editPropertyTax, deletePropertyTax,
  markTaxPaid, aiExtractTaxPdf,
  type PropertyTaxItem,
} from "@/lib/api";
import { formatHuf, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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

const PropertyTax = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [items, setItems] = useState<PropertyTaxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emptyForm = {
    year: new Date().getFullYear().toString(),
    bank_account: "",
    recipient: "",
    annual_amount: "",
    installment_amount: "",
    payment_memo: "",
    deadline_autumn: "",
    deadline_spring: "",
    include_in_roi: true,
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    getPropertyTaxes(propertyId)
      .then((data) => setItems(data.taxes))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: PropertyTaxItem) => {
    setEditingId(item.id);
    setForm({
      year: String(item.year),
      bank_account: item.bank_account || "",
      recipient: item.recipient || "",
      annual_amount: item.annual_amount ? String(item.annual_amount) : "",
      installment_amount: item.installment_amount ? String(item.installment_amount) : "",
      payment_memo: item.payment_memo || "",
      deadline_autumn: item.deadline_autumn || "",
      deadline_spring: item.deadline_spring || "",
      include_in_roi: item.include_in_roi,
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        year: Number(form.year),
        bank_account: form.bank_account || null,
        recipient: form.recipient || null,
        annual_amount: form.annual_amount ? Number(form.annual_amount) : 0,
        installment_amount: form.installment_amount ? Number(form.installment_amount) : null,
        payment_memo: form.payment_memo || null,
        deadline_autumn: form.deadline_autumn || null,
        deadline_spring: form.deadline_spring || null,
        include_in_roi: form.include_in_roi,
        notes: form.notes || null,
      };
      if (editingId) {
        await editPropertyTax(editingId, payload);
      } else {
        await addPropertyTax(propertyId, payload);
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePropertyTax(id);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      toast.error(e.message || t('common.error'));
    }
  };

  const handleMarkPaid = async (taxId: number, installment: "autumn" | "spring") => {
    try {
      await markTaxPaid(taxId, installment);
      load();
    } catch (e: any) {
      toast.error(e.message || t('common.error'));
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const result = await aiExtractTaxPdf(file);
      setForm((f) => ({
        ...f,
        bank_account: result.bank_account || f.bank_account,
        recipient: result.recipient || f.recipient,
        annual_amount: result.amount ? String(result.amount) : f.annual_amount,
        installment_amount: result.installment ? String(result.installment) : f.installment_amount,
        payment_memo: result.payment_memo || f.payment_memo,
        year: result.year ? String(result.year) : f.year,
      }));
      toast.success(t('tax.extractSuccess'));
    } catch {
      toast.error(t('tax.extractError'));
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text: string, msgKey: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t(msgKey));
  };

  const totalAnnual = items.reduce((sum, t) => sum + (t.annual_amount || 0), 0);

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="glass-card p-3 px-5">
          <span className="text-xs text-muted-foreground">{t('tax.title')}: </span>
          <span className="font-display font-bold format-hu">{formatHuf(totalAnnual)}</span>
          <span className="text-xs text-muted-foreground ml-2">({items.length} db)</span>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t('tax.new')}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('tax.noItems')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Landmark className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-display font-bold text-lg">{item.year}</span>
                    <span className="font-display font-bold format-hu">{formatHuf(item.annual_amount)}</span>
                    {item.include_in_roi && (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                        ROI
                      </Badge>
                    )}
                  </div>

                  {/* Installment badges */}
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => !item.autumn_paid && handleMarkPaid(item.id, "autumn")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        item.autumn_paid
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 cursor-pointer"
                      }`}
                      disabled={item.autumn_paid}
                    >
                      {item.autumn_paid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {t('tax.deadlineAutumn')}: {item.deadline_autumn ? formatDate(item.deadline_autumn) : "szept. 15"}
                      {" — "}
                      {item.autumn_paid ? t('tax.paid') : t('tax.unpaid')}
                    </button>

                    <button
                      onClick={() => !item.spring_paid && handleMarkPaid(item.id, "spring")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        item.spring_paid
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 cursor-pointer"
                      }`}
                      disabled={item.spring_paid}
                    >
                      {item.spring_paid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {t('tax.deadlineSpring')}: {item.deadline_spring ? formatDate(item.deadline_spring) : "márc. 15"}
                      {" — "}
                      {item.spring_paid ? t('tax.paid') : t('tax.unpaid')}
                    </button>
                  </div>

                  {/* Bank info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {item.recipient && <span>{item.recipient}</span>}
                    {item.bank_account && (
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => copyToClipboard(item.bank_account!, 'tax.copyAccount')}
                      >
                        <Copy className="h-3 w-3" /> {item.bank_account}
                      </button>
                    )}
                    {item.payment_memo && (
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => copyToClipboard(item.payment_memo!, 'tax.copyMemo')}
                      >
                        <Copy className="h-3 w-3" /> {item.payment_memo}
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? t('tax.editTitle') : t('tax.newTitle')}</DialogTitle>
            <DialogDescription>{editingId ? t('tax.editTitle') : t('tax.newTitle')}</DialogDescription>
          </DialogHeader>

          {/* PDF Upload */}
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {extracting ? t('tax.extracting') : t('tax.uploadPdf')}
            </Button>
            <span className="text-xs text-muted-foreground">AI PDF feldolgozás</span>
          </div>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('tax.year')} *</label>
                <Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('tax.annualAmount')} *</label>
                <Input type="number" value={form.annual_amount} onChange={(e) => set("annual_amount", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tax.installmentAmount')}</label>
              <Input type="number" value={form.installment_amount} onChange={(e) => set("installment_amount", e.target.value)} placeholder="Éves / 2" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tax.bankAccount')}</label>
              <Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} placeholder="12345678-12345678-12345678" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tax.recipient')}</label>
              <Input value={form.recipient} onChange={(e) => set("recipient", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tax.paymentMemo')}</label>
              <Input value={form.payment_memo} onChange={(e) => set("payment_memo", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('tax.deadlineAutumn')}</label>
                <Input type="date" value={form.deadline_autumn} onChange={(e) => set("deadline_autumn", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t('tax.deadlineSpring')}</label>
                <Input type="date" value={form.deadline_spring} onChange={(e) => set("deadline_spring", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.include_in_roi} onCheckedChange={(v) => set("include_in_roi", v)} />
              <label className="text-sm">{t('tax.includeRoi')}</label>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tax.notes')}</label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !form.year || !form.annual_amount} className="gradient-primary-bg border-0">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('tax.deleteConfirm')}</AlertDialogDescription>
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

export default PropertyTax;
