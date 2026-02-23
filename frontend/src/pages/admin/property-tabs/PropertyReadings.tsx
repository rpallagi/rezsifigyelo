import { useEffect, useState, useRef } from "react";
import { Zap, Droplets, Waves, Flame, TrendingUp, TrendingDown, Plus, Camera, Trash2, Loader2 } from "lucide-react";
import {
  getPropertyReadings, adminSubmitReading, deletePropertyReadingsByUtility,
  type PropertyReadingsData, type ReadingItem,
} from "@/lib/api";
import { formatHuf, formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/lib/i18n";

interface Props {
  propertyId: number;
  propertyName: string;
  tariffGroupId: number;
}

const PropertyReadings = ({ propertyId, propertyName, tariffGroupId }: Props) => {
  const { t } = useI18n();
  const [data, setData] = useState<PropertyReadingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingUtility, setDeletingUtility] = useState<string | null>(null);
  const [readingForm, setReadingForm] = useState({
    utility_type: "villany",
    value: "",
    reading_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    getPropertyReadings(propertyId)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [propertyId]);

  const handleSubmitReading = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("property_id", String(propertyId));
      fd.append("utility_type", readingForm.utility_type);
      fd.append("value", readingForm.value);
      fd.append("reading_date", readingForm.reading_date);
      if (readingForm.notes) fd.append("notes", readingForm.notes);
      if (photo) fd.append("photo", photo);

      await adminSubmitReading(fd);
      setDialogOpen(false);
      setReadingForm({ utility_type: "villany", value: "", reading_date: new Date().toISOString().split("T")[0], notes: "" });
      setPhoto(null);
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUtilityReadings = async (utilityType: string, utilityLabel: string) => {
    const ok = window.confirm(
      t('adminReadings.deleteUtilityConfirm')
        .replace('{utility}', utilityLabel)
        .replace('{property}', propertyName),
    );
    if (!ok) return;

    setDeletingUtility(utilityType);
    try {
      const res = await deletePropertyReadingsByUtility(propertyId, utilityType as any);
      alert(t('adminReadings.deleteUtilityDone').replace('{count}', String(res.deleted || 0)));
      load();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setDeletingUtility(null);
    }
  };

  const utilityIcon = (type: string) => {
    if (type === 'villany') return <Zap className="h-4 w-4" style={{ color: "hsl(45, 93%, 47%)" }} />;
    if (type === 'viz') return <Droplets className="h-4 w-4" style={{ color: "hsl(199, 89%, 48%)" }} />;
    if (type === 'gaz') return <Flame className="h-4 w-4" style={{ color: "hsl(20, 90%, 52%)" }} />;
    return <Waves className="h-4 w-4" style={{ color: "hsl(280, 60%, 55%)" }} />;
  };

  const utilityColor = (type: string) => {
    if (type === 'villany') return 'hsl(45, 93%, 47%)';
    if (type === 'viz') return 'hsl(199, 89%, 48%)';
    if (type === 'gaz') return 'hsl(20, 90%, 52%)';
    return 'hsl(280, 60%, 55%)';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const { readings, trends, sparklines } = data;

  const cardDefs = [
    { type: "villany", label: t('common.villany'), icon: Zap, color: "hsl(45, 93%, 47%)", trend: trends.villany, spark: sparklines.villany },
    { type: "viz", label: t('common.viz'), icon: Droplets, color: "hsl(199, 89%, 48%)", trend: trends.viz, spark: sparklines.viz },
    { type: "gaz", label: t('common.gaz'), icon: Flame, color: "hsl(20, 90%, 52%)", trend: trends.gaz, spark: sparklines.gaz },
  ];

  const trendCards = cardDefs.filter((card) => {
    const hasReadings = readings.some((r) => r.utility_type === card.type);
    const hasSpark = Array.isArray(card.spark) && card.spark.length > 0;
    return hasReadings || hasSpark || Boolean(card.trend);
  });

  return (
    <div className="space-y-5">
      {/* Trend cards with sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {trendCards.map((card) => {
          const sparkData = (card.spark || []).map((v, i) => ({ v, i }));
          const changePct = card.trend?.change_pct ?? 0;
          const isUp = changePct > 0;

          return (
            <div key={card.type} className="glass-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <card.icon className="h-5 w-5" style={{ color: card.color }} />
                    <span className="font-display font-semibold text-sm">{card.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {card.trend && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${isUp ? 'text-red-500 border-red-200 bg-red-50 dark:bg-red-950' : 'text-green-500 border-green-200 bg-green-50 dark:bg-green-950'}`}
                      >
                        {isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {Math.abs(changePct).toFixed(1)}%
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteUtilityReadings(card.type, card.label)}
                      disabled={deletingUtility === card.type}
                      title={t('adminReadings.deleteUtilityTitle').replace('{utility}', card.label)}
                    >
                      {deletingUtility === card.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                {card.trend && (
                  <div className="flex items-end gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('adminReadings.consumption')}</p>
                      <p className="font-display font-bold text-xl format-hu">
                        {formatNumber(card.trend.current, 1)} {card.type === 'villany' ? 'kWh' : 'm³'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t('adminReadings.cost')}</p>
                      <p className="font-display font-bold text-sm format-hu text-muted-foreground">
                        {card.trend.previous > 0 ? `${formatNumber(card.trend.previous, 1)} →` : '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {sparkData.length > 1 && (
                <div className="h-16 px-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData}>
                      <defs>
                        <linearGradient id={`rd-spark-${card.type}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={card.color} strokeWidth={2}
                        fill={`url(#rd-spark-${card.type})`} dot={false} animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New reading button */}
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" />
          {t('adminReadings.newReading')}
        </Button>
      </div>

      {/* Readings list */}
      <div className="space-y-2">
        {readings.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground text-sm">{t('adminReadings.noResults')}</p>
          </div>
        ) : (
          readings.map((r) => (
            <div
              key={r.id}
              className="glass-card p-4 flex items-center gap-3"
              style={{ borderLeft: `3px solid ${utilityColor(r.utility_type)}` }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${utilityColor(r.utility_type)}15` }}>
                {utilityIcon(r.utility_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {r.utility_type === 'villany'
                      ? t('common.villany')
                      : r.utility_type === 'viz'
                        ? t('common.viz')
                        : r.utility_type === 'gaz'
                          ? t('common.gaz')
                          : t('common.csatorna')}
                  </Badge>
                  {r.photo_filename && <Camera className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(r.reading_date)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-display font-bold text-sm format-hu">
                  {formatNumber(r.value, 1)} {r.utility_type === 'villany' ? 'kWh' : 'm³'}
                </p>
                {r.consumption != null && (
                  <p className="text-xs text-muted-foreground format-hu">
                    {t('adminReadings.consumption')}: {formatNumber(r.consumption, 1)}
                  </p>
                )}
                {r.cost_huf != null && (
                  <p className="text-xs font-medium format-hu">{formatHuf(r.cost_huf)}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Submit reading dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t('adminReadings.newReading')}</DialogTitle>
            <DialogDescription>{propertyName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.utilityType')} *</label>
              <Select value={readingForm.utility_type} onValueChange={(v) => setReadingForm(f => ({...f, utility_type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="villany">{t('common.villany')}</SelectItem>
                  <SelectItem value="viz">{t('common.viz')}</SelectItem>
                  <SelectItem value="gaz">{t('common.gaz')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.meterValue')} *</label>
              <Input
                type="number"
                step="0.1"
                value={readingForm.value}
                onChange={(e) => setReadingForm(f => ({...f, value: e.target.value}))}
                placeholder={t('adminReadings.enterValue')}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.date')}</label>
              <Input
                type="date"
                value={readingForm.reading_date}
                onChange={(e) => setReadingForm(f => ({...f, reading_date: e.target.value}))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.photo')}</label>
              <Input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSubmitReading}
              disabled={saving || !readingForm.value}
              className="gradient-primary-bg border-0"
            >
              {saving ? t('common.saving') : t('adminReadings.submitReading')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyReadings;
