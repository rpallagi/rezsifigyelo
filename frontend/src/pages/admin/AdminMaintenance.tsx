import { useEffect, useState } from "react";
import { Wrench, Plus, Calendar, User, Tag, Pencil, Trash2 } from "lucide-react";
import {
  getAdminMaintenance, addMaintenance, editMaintenance, deleteMaintenance, getAdminProperties,
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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

const categoryColor: Record<string, string> = {
  javitas: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  karbantartas: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  felujitas: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
  csere: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  takaritas: "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  lakatossag: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800",
  festes: "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-950 dark:text-pink-400 dark:border-pink-800",
  villanyszereles: "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
  vizszereles: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-800",
  egyeb: "",
};

const AdminMaintenance = () => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<MaintenanceItem[]>([]);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMaint, setEditingMaint] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const categoryLabels: Record<string, string> = {
    javitas: t('maint.catRepair'),
    karbantartas: t('maint.catMaintenance'),
    felujitas: t('maint.catRenovation'),
    csere: t('maint.catReplacement'),
    takaritas: t('maint.catCleaning'),
    lakatossag: t('maint.catLocksmith'),
    festes: t('maint.catPainting'),
    villanyszereles: t('maint.catElectrical'),
    vizszereles: t('maint.catPlumbing'),
    egyeb: t('common.egyeb'),
  };

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
    setEditingMaint(null);
    setDialogOpen(true);
  };

  const openEdit = (log: MaintenanceItem) => {
    setForm({
      property_id: log.property_id ? String(log.property_id) : "",
      description: log.description,
      category: log.category || "karbantartas",
      cost_huf: log.cost_huf != null ? String(log.cost_huf) : "",
      performed_by: log.performed_by || "",
      performed_date: log.performed_date || new Date().toISOString().split("T")[0],
    });
    setEditingMaint(log.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        property_id: form.property_id ? Number(form.property_id) : null,
        description: form.description,
        category: form.category,
        cost_huf: form.cost_huf ? Number(form.cost_huf) : null,
        performed_by: form.performed_by || null,
        performed_date: form.performed_date || null,
      };
      if (editingMaint) {
        await editMaintenance(editingMaint, payload);
      } else {
        await addMaintenance(payload);
      }
      setDialogOpen(false);
      setEditingMaint(null);
      loadLogs();
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
      loadLogs();
    } catch (e: any) {
      alert(e.message || t('common.error'));
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
          <h1 className="font-display text-2xl font-bold">{t('maint.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{logs.length} {t('maint.subtitle')}</p>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t('maint.new')}
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="glass-card p-12 text-center animate-in-delay-1">
          <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('maint.noEntries')}</p>
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
                  <div className="flex items-center gap-1 mb-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(log)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(log.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
            <DialogTitle className="font-display">{editingMaint ? t('maint.editTitle') : t('maint.newTitle')}</DialogTitle>
            <DialogDescription>{t('maint.newDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.property')}</label>
              <Select value={form.property_id} onValueChange={(v) => set("property_id", v)}>
                <SelectTrigger><SelectValue placeholder={t('maint.selectProperty')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('common.notSpecified')}</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.description')} *</label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder={t('maint.descPlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.category')}</label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="javitas">{t('maint.catRepair')}</SelectItem>
                  <SelectItem value="karbantartas">{t('maint.catMaintenance')}</SelectItem>
                  <SelectItem value="felujitas">{t('maint.catRenovation')}</SelectItem>
                  <SelectItem value="csere">{t('maint.catReplacement')}</SelectItem>
                  <SelectItem value="takaritas">{t('maint.catCleaning')}</SelectItem>
                  <SelectItem value="lakatossag">{t('maint.catLocksmith')}</SelectItem>
                  <SelectItem value="festes">{t('maint.catPainting')}</SelectItem>
                  <SelectItem value="villanyszereles">{t('maint.catElectrical')}</SelectItem>
                  <SelectItem value="vizszereles">{t('maint.catPlumbing')}</SelectItem>
                  <SelectItem value="egyeb">{t('common.egyeb')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.cost')}</label>
              <Input
                type="number"
                value={form.cost_huf}
                onChange={(e) => set("cost_huf", e.target.value)}
                placeholder={t('maint.costPlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.performedBy')}</label>
              <Input
                value={form.performed_by}
                onChange={(e) => set("performed_by", e.target.value)}
                placeholder={t('maint.performedByPlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('maint.date')}</label>
              <Input type="date" value={form.performed_date} onChange={(e) => set("performed_date", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.description}
              className="gradient-primary-bg border-0"
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t('common.confirmDelete')}</AlertDialogTitle>
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

export default AdminMaintenance;
