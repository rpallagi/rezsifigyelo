import { useEffect, useState } from "react";
import { BarChart3, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getAdminTariffs, addTariff, editTariff, deleteTariff,
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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

const AdminTariffs = () => {
  const { t } = useI18n();
  const [groups, setGroups] = useState<TariffGroupDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTariff, setEditingTariff] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

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
    setEditingTariff(null);
    setForm({
      tariff_group_id: groups.length > 0 ? String(groups[0].id) : "",
      utility_type: "villany",
      rate_huf: "",
      unit: "kWh",
      valid_from: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(true);
  };

  const openEdit = (tariff: { id: number; utility_type: string; rate_huf: number; unit: string; valid_from: string }, groupId: number) => {
    setForm({
      tariff_group_id: String(groupId),
      utility_type: tariff.utility_type,
      rate_huf: String(tariff.rate_huf),
      unit: tariff.unit,
      valid_from: tariff.valid_from,
    });
    setEditingTariff(tariff.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        tariff_group_id: Number(form.tariff_group_id),
        utility_type: form.utility_type,
        rate_huf: Number(form.rate_huf),
        unit: form.unit,
        valid_from: form.valid_from,
      };
      if (editingTariff) {
        await editTariff(editingTariff, payload);
      } else {
        await addTariff(payload);
      }
      setDialogOpen(false);
      setEditingTariff(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTariff(id);
      setDeleteConfirm(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
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
          <h1 className="font-display text-2xl font-bold">{t('tariffs.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('tariffs.desc')}</p>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t('tariffs.new')}
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="glass-card p-12 text-center animate-in-delay-1">
          <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('tariffs.noGroups')}</p>
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
                  {t('tariffs.noTariffs')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tariffs.utilityType')}</TableHead>
                      <TableHead className="text-right">{t('tariffs.rate')}</TableHead>
                      <TableHead>{t('tariffs.unit')}</TableHead>
                      <TableHead>{t('tariffs.validFrom')}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.tariffs.map((tar) => (
                      <TableRow key={tar.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {utilityLabel(tar.utility_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-display font-bold text-sm format-hu">
                          {formatHuf(tar.rate_huf)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          /{tar.unit}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(tar.valid_from)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tar, group.id)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(tar.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
            <DialogTitle className="font-display">{editingTariff ? t('tariffs.editTitle') : t('tariffs.newTitle')}</DialogTitle>
            <DialogDescription>{t('tariffs.newDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tariffs.group')} *</label>
              <Select value={form.tariff_group_id} onValueChange={(v) => set("tariff_group_id", v)}>
                <SelectTrigger><SelectValue placeholder={t('tariffs.selectGroup')} /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tariffs.utilityType')} *</label>
              <Select value={form.utility_type} onValueChange={handleUtilityChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="villany">{t('common.villany')}</SelectItem>
                  <SelectItem value="viz">{t('common.viz')}</SelectItem>
                  <SelectItem value="gaz">{t('common.gaz')}</SelectItem>
                  <SelectItem value="csatorna">{t('common.csatorna')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tariffs.rateFt')} *</label>
              <Input
                type="number"
                step="0.01"
                value={form.rate_huf}
                onChange={(e) => set("rate_huf", e.target.value)}
                placeholder={t('tariffs.ratePlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tariffs.unit')}</label>
              <Input
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder={t('tariffs.unitPlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('tariffs.validFromDate')} *</label>
              <Input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.tariff_group_id || !form.rate_huf}
              className="gradient-primary-bg border-0"
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('tariffs.deleteConfirm')}</AlertDialogDescription>
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

export default AdminTariffs;
