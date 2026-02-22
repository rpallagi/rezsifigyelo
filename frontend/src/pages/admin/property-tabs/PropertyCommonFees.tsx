import { useEffect, useRef, useState } from "react";
import { Building, Plus, Pencil, Trash2, Copy, Upload, Check, Calendar } from "lucide-react";
import {
  getPropertyCommonFees, addCommonFee, editCommonFee, deleteCommonFee,
  markCommonFeePaid, aiExtractFeePdf,
  type CommonFeeItem,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate an array of YYYY-MM-01 strings for the last 6 months + current month. */
function generateCalendarMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}-${mm}-01`);
  }
  return months;
}

/** Hungarian month label from a YYYY-MM-DD string. */
function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("hu-HU", { year: "numeric", month: "long" });
}

/** Copy text to clipboard, show a toast. */
async function copyToClipboard(text: string, successMsg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMsg);
  } catch {
    toast.error("Nem sikerült a vágólapra másolni");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  propertyId: number;
}

const emptyForm = {
  bank_account: "",
  recipient: "",
  monthly_amount: "",
  payment_memo: "",
  frequency: "monthly",
  payment_day: "15",
  include_in_roi: true,
  is_active: true,
  valid_from: "",
  valid_to: "",
  notes: "",
};

type FormState = typeof emptyForm;

const PropertyCommonFees = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<CommonFeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null); // "feeId-period"

  const [form, setForm] = useState<FormState>(emptyForm);

  // ---- Data loading ----

  const load = () => {
    setLoading(true);
    getPropertyCommonFees(propertyId)
      .then((data) => setItems(data.fees))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [propertyId]);

  // ---- Form helpers ----

  const set = (key: keyof FormState, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (fee: CommonFeeItem) => {
    setEditingId(fee.id);
    setForm({
      bank_account: fee.bank_account || "",
      recipient: fee.recipient || "",
      monthly_amount: String(fee.monthly_amount),
      payment_memo: fee.payment_memo || "",
      frequency: fee.frequency || "monthly",
      payment_day: fee.payment_day != null ? String(fee.payment_day) : "15",
      include_in_roi: fee.include_in_roi,
      is_active: fee.is_active,
      valid_from: fee.valid_from || "",
      valid_to: fee.valid_to || "",
      notes: fee.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        bank_account: form.bank_account || null,
        recipient: form.recipient || null,
        monthly_amount: Number(form.monthly_amount),
        payment_memo: form.payment_memo || null,
        frequency: form.frequency,
        payment_day: form.payment_day ? Number(form.payment_day) : null,
        include_in_roi: form.include_in_roi,
        is_active: form.is_active,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        notes: form.notes || null,
      };
      if (editingId) {
        await editCommonFee(editingId, payload);
      } else {
        await addCommonFee(propertyId, payload);
      }
      setDialogOpen(false);
      toast.success(t("common.success"));
      load();
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCommonFee(id);
      setDeleteConfirm(null);
      toast.success(t("common.success"));
      load();
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    }
  };

  // ---- Payment calendar ----

  const handleMarkPaid = async (feeId: number, periodDate: string) => {
    const key = `${feeId}-${periodDate}`;
    setMarkingPaid(key);
    try {
      await markCommonFeePaid(feeId, periodDate);
      toast.success(t("fees.paid"));
      load();
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    } finally {
      setMarkingPaid(null);
    }
  };

  // ---- PDF extraction ----

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const result = await aiExtractFeePdf(file);
      const ex = result.extracted || {};
      setForm((f) => ({
        ...f,
        bank_account: ex.bank_account || f.bank_account,
        recipient: ex.recipient || f.recipient,
        monthly_amount: ex.monthly_amount != null ? String(ex.monthly_amount) : f.monthly_amount,
        payment_memo: ex.payment_memo || f.payment_memo,
        frequency: ex.frequency || f.frequency,
        payment_day: ex.payment_day != null ? String(ex.payment_day) : f.payment_day,
      }));
      toast.success(t("fees.extractSuccess"));
      if (!dialogOpen) {
        setEditingId(null);
        setDialogOpen(true);
      }
    } catch {
      toast.error(t("fees.extractError"));
    } finally {
      setExtracting(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---- Derived data ----

  const activeFees = items.filter((f) => f.is_active);
  const calendarMonths = generateCalendarMonths();
  const totalMonthly = activeFees.reduce((s, f) => s + f.monthly_amount, 0);

  // ---- Frequency label ----

  const freqLabel = (freq: string) =>
    freq === "quarterly" ? t("fees.quarterly") : t("fees.monthly");

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="glass-card p-3 px-5">
          <span className="text-xs text-muted-foreground">{t("fees.title")}: </span>
          <span className="font-display font-bold format-hu">{formatHuf(totalMonthly)}</span>
          <span className="text-xs text-muted-foreground ml-2">
            ({activeFees.length} {t("common.db")})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Hidden file input for PDF */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handlePdfUpload}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={extracting}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {extracting ? t("fees.extracting") : t("fees.uploadPdf")}
          </Button>
          <Button onClick={openNew} className="gradient-primary-bg border-0">
            <Plus className="h-4 w-4 mr-2" /> {t("fees.new")}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Building className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("fees.noItems")}</p>
        </div>
      ) : (
        <>
          {/* Active fee cards */}
          <div className="space-y-3">
            {items.map((fee) => (
              <div
                key={fee.id}
                className={`glass-card p-4 ${!fee.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Top row: amount + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-base format-hu">
                        {formatHuf(fee.monthly_amount)}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          fee.is_active
                            ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                            : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800"
                        }
                      >
                        {fee.is_active ? t("fees.isActive") : "Inaktív"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {freqLabel(fee.frequency)}
                      </Badge>
                      {fee.payment_day && (
                        <span className="text-xs text-muted-foreground">
                          {t("fees.paymentDay")}: {fee.payment_day}.
                        </span>
                      )}
                    </div>

                    {/* Bank account row */}
                    {fee.bank_account && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">{t("fees.bankAccount")}:</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                          {fee.bank_account}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            copyToClipboard(fee.bank_account!, t("fees.copyAccount"))
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Payment memo row */}
                    {fee.payment_memo && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">{t("fees.paymentMemo")}:</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                          {fee.payment_memo}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            copyToClipboard(fee.payment_memo!, t("fees.copyMemo"))
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Validity / notes */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {fee.valid_from && (
                        <span>
                          {t("fees.validFrom")}: {formatDate(fee.valid_from)}
                        </span>
                      )}
                      {fee.valid_to && (
                        <span>
                          {t("fees.validTo")}: {formatDate(fee.valid_to)}
                        </span>
                      )}
                      {fee.recipient && <span>· {fee.recipient}</span>}
                    </div>

                    {/* Payment calendar */}
                    {fee.is_active && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("fees.paymentCalendar")}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                          {calendarMonths.map((month) => {
                            const payment = fee.payments?.find(
                              (p) => p.period_date.slice(0, 7) === month.slice(0, 7)
                            );
                            const isPaid = payment?.paid ?? false;
                            const paidKey = `${fee.id}-${month}`;
                            const isMarking = markingPaid === paidKey;

                            return (
                              <button
                                key={month}
                                disabled={isPaid || isMarking}
                                className={`
                                  flex flex-col items-center gap-0.5 p-2 rounded-lg text-xs transition-colors
                                  ${
                                    isPaid
                                      ? "bg-green-50 dark:bg-green-950/40 cursor-default"
                                      : "bg-muted/50 hover:bg-muted cursor-pointer"
                                  }
                                `}
                                onClick={() => {
                                  if (!isPaid && !isMarking) {
                                    handleMarkPaid(fee.id, month);
                                  }
                                }}
                                title={
                                  isPaid
                                    ? `${t("fees.paid")}${payment?.paid_date ? ` - ${formatDate(payment.paid_date)}` : ""}`
                                    : t("fees.markPaid")
                                }
                              >
                                <span className="font-medium truncate w-full text-center">
                                  {monthLabel(month)}
                                </span>
                                {isPaid ? (
                                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                ) : isMarking ? (
                                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                ) : (
                                  <span className="h-3.5 w-3.5 rounded-sm border border-muted-foreground/30" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(fee)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteConfirm(fee.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- Add / Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? t("fees.editTitle") : t("fees.newTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingId ? t("fees.editTitle") : t("fees.newTitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* PDF upload inside dialog */}
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={extracting}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {extracting ? t("fees.extracting") : t("fees.uploadPdf")}
              </Button>
            </div>

            {/* Bank account */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("fees.bankAccount")}
              </label>
              <Input
                value={form.bank_account}
                onChange={(e) => set("bank_account", e.target.value)}
                placeholder="11111111-22222222-33333333"
              />
            </div>

            {/* Recipient */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("fees.recipient")}
              </label>
              <Input
                value={form.recipient}
                onChange={(e) => set("recipient", e.target.value)}
              />
            </div>

            {/* Monthly amount + Payment day */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("fees.monthlyAmount")} *
                </label>
                <Input
                  type="number"
                  value={form.monthly_amount}
                  onChange={(e) => set("monthly_amount", e.target.value)}
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("fees.paymentDay")} (1-28)
                </label>
                <Input
                  type="number"
                  value={form.payment_day}
                  onChange={(e) => set("payment_day", e.target.value)}
                  min="1"
                  max="28"
                />
              </div>
            </div>

            {/* Payment memo */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("fees.paymentMemo")}
              </label>
              <Input
                value={form.payment_memo}
                onChange={(e) => set("payment_memo", e.target.value)}
              />
            </div>

            {/* Frequency */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("fees.frequency")}
              </label>
              <Select value={form.frequency} onValueChange={(v) => set("frequency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t("fees.monthly")}</SelectItem>
                  <SelectItem value="quarterly">{t("fees.quarterly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Validity dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("fees.validFrom")}
                </label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => set("valid_from", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  {t("fees.validTo")}
                </label>
                <Input
                  type="date"
                  value={form.valid_to}
                  onChange={(e) => set("valid_to", e.target.value)}
                />
              </div>
            </div>

            {/* Switches: include_in_roi + is_active */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <label className="text-sm">{t("fees.includeRoi")}</label>
                <Switch
                  checked={form.include_in_roi}
                  onCheckedChange={(v) => set("include_in_roi", v)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <label className="text-sm">{t("fees.isActive")}</label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => set("is_active", v)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">
                {t("fees.notes")}
              </label>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.monthly_amount}
              className="gradient-primary-bg border-0"
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation ---- */}
      <AlertDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("fees.deleteConfirm")}</AlertDialogDescription>
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

export default PropertyCommonFees;
