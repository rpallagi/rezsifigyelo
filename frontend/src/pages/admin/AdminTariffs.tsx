import { useEffect, useState } from "react";
import { BarChart3, Plus } from "lucide-react";
import {
  getAdminTariffs, addTariff,
  type TariffGroupDetail,
} from "@/lib/api";
import { formatHuf, formatDate, utilityLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const AdminTariffs = () => {
  const [groups, setGroups] = useState<TariffGroupDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tariff_group_id: "",
    utility_type: "villany",
    rate_huf: "",
    unit: "kWh",
    valid_from: new Date().toISOString().split("T")[0],
  });

  const load = () => {
    setLoading(true);
    getAdminTariffs()
      .then((data) => setGroups(data.tariff_groups))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({
      tariff_group_id: groups.length > 0 ? String(groups[0].id) : "",
      utility_type: "villany",
      rate_huf: "",
      unit: "kWh",
      valid_from: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await addTariff({
        tariff_group_id: Number(form.tariff_group_id),
        utility_type: form.utility_type,
        rate_huf: Number(form.rate_huf),
        unit: form.unit,
        valid_from: form.valid_from,
      });
      setDialogOpen(false);
      load();
    } catch (e: any) {
      alert(e.message || "Hiba történt");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  // When utility_type changes, update unit default
  const handleUtilityChange = (v: string) => {
    set("utility_type", v);
    set("unit", v === "villany" ? "kWh" : "m\u00B3");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Tarifák</h1>
          <p className="text-muted-foreground text-sm mt-1">Közüzemi díjak kezelése csoportonként</p>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> Új tarifa
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="glass-card p-12 text-center animate-in-delay-1">
          <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nincsenek tarifa csoportok.</p>
        </div>
      ) : (
        <div className="space-y-4 animate-in-delay-1">
          {groups.map((group, idx) => (
            <div
              key={group.id}
              className={`glass-card ${idx === 0 ? "animate-in-delay-1" : idx === 1 ? "animate-in-delay-2" : "animate-in-delay-3"}`}
            >
              <div className="p-5 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold">{group.name}</h2>
                    {group.description && (
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {group.tariffs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Még nincsenek tarifák ebben a csoportban.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Közüzem típus</TableHead>
                      <TableHead className="text-right">Díj</TableHead>
                      <TableHead>Egység</TableHead>
                      <TableHead>Érvényes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.tariffs.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {utilityLabel(t.utility_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-display font-bold text-sm format-hu">
                          {formatHuf(t.rate_huf)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          /{t.unit}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(t.valid_from)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add tariff dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Új tarifa</DialogTitle>
            <DialogDescription>Adj hozzá egy új közüzemi tarifát.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Tarifa csoport *</label>
              <Select value={form.tariff_group_id} onValueChange={(v) => set("tariff_group_id", v)}>
                <SelectTrigger><SelectValue placeholder="Válassz csoportot..." /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Közüzem típus *</label>
              <Select value={form.utility_type} onValueChange={handleUtilityChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="villany">Villany</SelectItem>
                  <SelectItem value="viz">Víz</SelectItem>
                  <SelectItem value="csatorna">Csatorna</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Díj (Ft) *</label>
              <Input
                type="number"
                step="0.01"
                value={form.rate_huf}
                onChange={(e) => set("rate_huf", e.target.value)}
                placeholder="pl. 36.00"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Egység</label>
              <Input
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="pl. kWh, m³"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Érvényes dátumtól *</label>
              <Input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Mégse</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.tariff_group_id || !form.rate_huf}
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

export default AdminTariffs;
