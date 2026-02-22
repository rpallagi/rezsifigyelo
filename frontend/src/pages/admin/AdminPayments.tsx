import { useEffect, useState } from "react";
import { CreditCard, Plus, Banknote, Calendar, FileText } from "lucide-react";
import {
  getAdminPayments, addPayment, getAdminProperties,
  type PaymentItem, type AdminProperty,
} from "@/lib/api";
import { formatHuf, formatDate, formatDateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const AdminPayments = () => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    property_id: "",
    amount_huf: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "atutalas",
    period_from: "",
    period_to: "",
    notes: "",
  });

  useEffect(() => {
    getAdminProperties().then((data) => setProperties(data.properties));
  }, []);

  const loadPayments = () => {
    setLoading(true);
    const propId = filterProperty !== "all" ? Number(filterProperty) : undefined;
    getAdminPayments(propId)
      .then((data) => setPayments(data.payments))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPayments(); }, [filterProperty]);

  const openNew = () => {
    setForm({
      property_id: "",
      amount_huf: "",
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "atutalas",
      period_from: "",
      period_to: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await addPayment({
        property_id: Number(form.property_id),
        amount_huf: Number(form.amount_huf),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        period_from: form.period_from || null,
        period_to: form.period_to || null,
        notes: form.notes || null,
      });
      setDialogOpen(false);
      loadPayments();
    } catch (e: any) {
      alert(e.message || "Hiba történt");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const methodLabel = (m: string | null) => {
    if (m === "keszpenz") return "Készpénz";
    if (m === "atutalas") return "Átutalás";
    if (m === "egyeb") return "Egyéb";
    return m || "—";
  };

  const methodBadge = (m: string | null) => {
    if (m === "keszpenz")
      return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">Készpénz</Badge>;
    if (m === "atutalas")
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">Átutalás</Badge>;
    return <Badge variant="outline" className="text-xs">{methodLabel(m)}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Befizetések</h1>
          <p className="text-muted-foreground text-sm mt-1">Bérleti díjak és befizetések kezelése</p>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> Új befizetés
        </Button>
      </div>

      {/* Filter */}
      <div className="w-full sm:w-64 animate-in-delay-1">
        <label className="text-sm text-muted-foreground block mb-1">Szűrés ingatlanra</label>
        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes ingatlan</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card animate-in-delay-2">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nincs befizetés rögzítve.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingatlan</TableHead>
                <TableHead className="text-right">Összeg</TableHead>
                <TableHead>Dátum</TableHead>
                <TableHead>Mód</TableHead>
                <TableHead>Időszak</TableHead>
                <TableHead>Megjegyzés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.property_name}</TableCell>
                  <TableCell className="text-right font-display font-bold text-sm format-hu">
                    {formatHuf(p.amount_huf)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(p.payment_date)}
                  </TableCell>
                  <TableCell>{methodBadge(p.payment_method)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.period_from && p.period_to
                      ? `${formatDateShort(p.period_from)} - ${formatDateShort(p.period_to)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {p.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add payment dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Új befizetés</DialogTitle>
            <DialogDescription>Rögzíts egy új bérleti díj befizetést.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Ingatlan *</label>
              <Select value={form.property_id} onValueChange={(v) => set("property_id", v)}>
                <SelectTrigger><SelectValue placeholder="Válassz ingatlant..." /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Összeg (Ft) *</label>
              <Input
                type="number"
                value={form.amount_huf}
                onChange={(e) => set("amount_huf", e.target.value)}
                placeholder="pl. 150000"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Befizetés dátuma *</label>
              <Input type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Fizetési mód</label>
              <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keszpenz">Készpénz</SelectItem>
                  <SelectItem value="atutalas">Átutalás</SelectItem>
                  <SelectItem value="egyeb">Egyéb</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Időszak kezdete</label>
                <Input type="date" value={form.period_from} onChange={(e) => set("period_from", e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Időszak vége</label>
                <Input type="date" value={form.period_to} onChange={(e) => set("period_to", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Megjegyzés</label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Opcionális megjegyzés..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Mégse</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.property_id || !form.amount_huf}
              className="gradient-primary-bg border-0"
            >
              {saving ? "Mentés..." : "Mentés"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayments;
