import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ExternalLink, Image, Plus, Zap, Droplets, TrendingUp, TrendingDown } from "lucide-react";
import {
  getAdminReadings, getAdminProperties, adminSubmitReading,
  type ReadingItem, type AdminProperty,
} from "@/lib/api";
import { formatHuf, formatDate, formatNumber, utilityLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/lib/i18n";

const AdminReadings = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Admin submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    property_id: "",
    utility_type: "villany",
    value: "",
    reading_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const utilityTypes = [
    { value: "all", label: t('common.all') },
    { value: "villany", label: t('common.villany') },
    { value: "viz", label: t('common.viz') },
    { value: "csatorna", label: t('common.csatorna') },
  ];

  useEffect(() => {
    getAdminProperties().then((data) => setProperties(data.properties));
  }, []);

  const loadReadings = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filterProperty !== "all") params.property_id = filterProperty;
    if (filterType !== "all") params.utility_type = filterType;
    getAdminReadings(Object.keys(params).length > 0 ? params : undefined)
      .then((data) => setReadings(data.readings))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReadings(); }, [filterProperty, filterType]);

  const handleSubmit = async () => {
    if (!submitForm.property_id || !submitForm.value) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("property_id", submitForm.property_id);
      fd.append("utility_type", submitForm.utility_type);
      fd.append("value", submitForm.value.replace(",", "."));
      if (submitForm.reading_date) fd.append("reading_date", submitForm.reading_date);
      if (submitForm.notes) fd.append("notes", submitForm.notes);
      if (fileRef.current?.files?.[0]) fd.append("photo", fileRef.current.files[0]);

      await adminSubmitReading(fd);
      setSubmitOpen(false);
      setSubmitForm({
        property_id: "",
        utility_type: "villany",
        value: "",
        reading_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      if (fileRef.current) fileRef.current.value = "";
      loadReadings();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const borderColor = (type: string) => {
    if (type === "villany") return "border-l-amber-400";
    if (type === "viz") return "border-l-blue-400";
    return "border-l-purple-400";
  };

  // Build sparkline data and % change per utility type
  const buildSparkData = (utilityType: string) => {
    const typeReadings = readings
      .filter(r => r.utility_type === utilityType && r.consumption != null)
      .slice(0, 12)
      .reverse();
    return typeReadings.map((r, i) => ({ v: r.consumption || 0, i }));
  };

  const buildChange = (utilityType: string) => {
    const typeReadings = readings
      .filter(r => r.utility_type === utilityType && r.consumption != null)
      .slice(0, 2);
    if (typeReadings.length < 2) return null;
    const current = typeReadings[0].consumption || 0;
    const previous = typeReadings[1].consumption || 0;
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };

  const villanySparkData = buildSparkData("villany");
  const vizSparkData = buildSparkData("viz");
  const villanyChange = buildChange("villany");
  const vizChange = buildChange("viz");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('adminReadings.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('adminReadings.desc')}</p>
        </div>
        <Button onClick={() => setSubmitOpen(true)} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t('adminReadings.newReading')}
        </Button>
      </div>

      {/* Sparkline overview cards */}
      {filterProperty === "all" && filterType === "all" && readings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in-delay-1">
          {[
            { type: "villany", label: t('common.villany'), icon: Zap, color: "hsl(45, 93%, 47%)", sparkData: villanySparkData, change: villanyChange },
            { type: "viz", label: t('common.viz'), icon: Droplets, color: "hsl(199, 89%, 48%)", sparkData: vizSparkData, change: vizChange },
          ].map(card => (
            <div
              key={card.type}
              className="glass-card p-4 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setFilterType(card.type)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <card.icon className="h-4 w-4" style={{ color: card.color }} />
                  <span className="font-display font-semibold text-sm">{card.label}</span>
                </div>
                {card.change !== null && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${card.change <= 0 ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'}`}
                  >
                    {card.change <= 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                    {card.change > 0 ? "+" : ""}{card.change}%
                  </Badge>
                )}
              </div>
              {card.sparkData.length > 1 && (
                <div className="h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={card.sparkData}>
                      <defs>
                        <linearGradient id={`spark-${card.type}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={card.color}
                        strokeWidth={2}
                        fill={`url(#spark-${card.type})`}
                        dot={false}
                        animationDuration={800}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-in-delay-1">
        <div className="w-full sm:w-64">
          <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.property')}</label>
          <Select value={filterProperty} onValueChange={setFilterProperty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminReadings.allProperties')}</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.utilityType')}</label>
          <Tabs value={filterType} onValueChange={setFilterType}>
            <TabsList>
              {utilityTypes.map((ut) => (
                <TabsTrigger key={ut.value} value={ut.value}>{ut.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card animate-in-delay-2">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : readings.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('adminReadings.noResults')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminReadings.property')}</TableHead>
                <TableHead>{t('adminReadings.utilityType')}</TableHead>
                <TableHead className="text-right">{t('adminReadings.meterValue')}</TableHead>
                <TableHead className="text-right">{t('adminReadings.consumption')}</TableHead>
                <TableHead className="text-right">{t('adminReadings.cost')}</TableHead>
                <TableHead>{t('adminReadings.date')}</TableHead>
                <TableHead className="text-center">{t('adminReadings.photo')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.map((r) => (
                <TableRow key={r.id} className={`border-l-4 ${borderColor(r.utility_type)} hover:bg-accent/50 transition-colors`}>
                  <TableCell
                    className="font-medium text-sm cursor-pointer text-primary hover:underline"
                    onClick={() => navigate(`/admin/properties/${r.property_id}?tab=readings`)}
                  >
                    {r.property_name || "\u2014"}
                  </TableCell>
                  <TableCell>
                    <button onClick={() => setFilterType(r.utility_type)}>
                      <Badge
                        variant="outline"
                        className={`text-xs cursor-pointer hover:ring-1 ${
                          r.utility_type === 'villany' ? 'hover:ring-amber-300' :
                          r.utility_type === 'viz' ? 'hover:ring-blue-300' : 'hover:ring-purple-300'
                        }`}
                      >
                        {utilityLabel(r.utility_type)}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right text-sm format-hu">
                    {formatNumber(r.value, 2)} {r.utility_type === "villany" ? "kWh" : "m\u00B3"}
                  </TableCell>
                  <TableCell className="text-right text-sm format-hu">
                    {r.consumption != null
                      ? `${formatNumber(r.consumption, 2)} ${r.utility_type === "villany" ? "kWh" : "m\u00B3"}`
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-display font-bold format-hu">
                    {r.cost_huf != null ? formatHuf(r.cost_huf) : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(r.reading_date)}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.photo_filename ? (
                      <a
                        href={`/uploads/${r.photo_filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <Image className="h-3.5 w-3.5" />
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">\u2014</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Admin Submit Reading Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t('adminReadings.newReading')}</DialogTitle>
            <DialogDescription>{t('adminReadings.submitReading')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.property')} *</label>
              <Select
                value={submitForm.property_id}
                onValueChange={(v) => setSubmitForm(f => ({ ...f, property_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder={t('adminReadings.selectProperty')} /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.utilityType')} *</label>
              <Select
                value={submitForm.utility_type}
                onValueChange={(v) => setSubmitForm(f => ({ ...f, utility_type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="villany">{t('common.villany')}</SelectItem>
                  <SelectItem value="viz">{t('common.viz')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.meterValue')} *</label>
              <Input
                type="number"
                step="0.01"
                value={submitForm.value}
                onChange={(e) => setSubmitForm(f => ({ ...f, value: e.target.value }))}
                placeholder={t('adminReadings.enterValue')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.date')}</label>
              <Input
                type="date"
                value={submitForm.reading_date}
                onChange={(e) => setSubmitForm(f => ({ ...f, reading_date: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('adminReadings.photo')}</label>
              <input ref={fileRef} type="file" accept="image/*" className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !submitForm.property_id || !submitForm.value}
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

export default AdminReadings;
