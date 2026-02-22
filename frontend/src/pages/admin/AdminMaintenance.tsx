import { useEffect, useState } from "react";
import { Wrench, Plus, Calendar, User, Tag } from "lucide-react";
import {
  getAdminMaintenance, addMaintenance, getAdminProperties,
  type MaintenanceItem, type AdminProperty,
} from "@/lib/api";
import { formatHuf, formatDate } from "@/lib/format";
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

const categoryLabels: Record<string, string> = {
  javitas: "Javítás",
  karbantartas: "Karbantartás",
  felujitas: "Felújítás",
  csere: "Csere",
  egyeb: "Egyéb",
};

const categoryColor: Record<string, string> = {
  javitas: "bg-red-50 text-red-600 border-red-200",
  karbantartas: "bg-blue-50 text-blue-600 border-blue-200",
  felujitas: "bg-purple-50 text-purple-600 border-purple-200",
  csere: "bg-amber-50 text-amber-600 border-amber-200",
  egyeb: "",
};

const AdminMaintenance = () => {
  const [logs, setLogs] = useState<MaintenanceItem[]>([]);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    property_id: "",
    description: "",
    category: "karbantartas",
    cost_huf: "",
    performed_by: "",
    performed_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    getAdminProperties().then((data) => setProperties(data.properties));
    loadLogs();
  }, []);

  const loadLogs = () => {
    setLoading(true);
    getAdminMaintenance()
      .then((data) => setLogs(data.logs))
      .finally(() => setLoading(false));
  };

  const openNew = () => {
    setForm({
      property_id: "",
      description: "",
      category: "karbantartas",
      cost_huf: "",
      performed_by: "",
      performed_date: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await addMaintenance({
        property_id: form.property_id ? Number(form.property_id) : null,
        description: form.description,
        category: form.category,
        cost_huf: form.cost_huf ? Number(form.cost_huf) : null,
        performed_by: form.performed_by || null,
        performed_date: form.performed_date || null,
      });
      setDialogOpen(false);
      loadLogs();
    } catch (e: any) {
      alert(e.message || "Hiba történt");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Karbantartás</h1>
          <p className="text-muted-foreground text-sm mt-1">{logs.length} bejegyzés</p>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> Új bejegyzés
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="glass-card p-12 text-center animate-in-delay-1">
          <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Még nincs karbantartási bejegyzés.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-in-delay-1">
          {logs.map((log) => (
            <div key={log.id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                    <Wrench className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{log.description}</p>
                    {log.property_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.property_name}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {log.category && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${categoryColor[log.category] || ""}`}
                        >
                          {categoryLabels[log.category] || log.category}
                        </Badge>
                      )}
                      {log.performed_by && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" /> {log.performed_by}
                        </span>
                      )}
                      {log.performed_date && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {formatDate(log.performed_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {log.cost_huf != null && (
                    <p className="font-display font-bold text-sm format-hu">{formatHuf(log.cost_huf)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Új karbantartási bejegyzés</DialogTitle>
            <DialogDescription>Rögzíts egy új karbantartási vagy javítási tételt.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Ingatlan (opcionális)</label>
              <Select value={form.property_id} onValueChange={(v) => set("property_id", v)}>
                <SelectTrigger><SelectValue placeholder="Válassz ingatlant..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nincs megadva</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Leírás *</label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Mi történt, mit kellett csinálni..."
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Kategória</label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="javitas">Javítás</SelectItem>
                  <SelectItem value="karbantartas">Karbantartás</SelectItem>
                  <SelectItem value="felujitas">Felújítás</SelectItem>
                  <SelectItem value="csere">Csere</SelectItem>
                  <SelectItem value="egyeb">Egyéb</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Költség (Ft)</label>
              <Input
                type="number"
                value={form.cost_huf}
                onChange={(e) => set("cost_huf", e.target.value)}
                placeholder="pl. 25000"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Ki végezte</label>
              <Input
                value={form.performed_by}
                onChange={(e) => set("performed_by", e.target.value)}
                placeholder="pl. Kovács János"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Dátum</label>
              <Input type="date" value={form.performed_date} onChange={(e) => set("performed_date", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Mégse</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.description}
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

export default AdminMaintenance;
