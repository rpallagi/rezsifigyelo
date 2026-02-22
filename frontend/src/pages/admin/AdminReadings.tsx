import { useEffect, useState } from "react";
import { FileText, ExternalLink, Image } from "lucide-react";
import {
  getAdminReadings, getAdminProperties,
  type ReadingItem, type AdminProperty,
} from "@/lib/api";
import { formatHuf, formatDate, formatNumber, utilityLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";

const AdminReadings = () => {
  const { t } = useI18n();
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const utilityTypes = [
    { value: "all", label: t('common.all') },
    { value: "villany", label: t('common.villany') },
    { value: "viz", label: t('common.viz') },
    { value: "csatorna", label: t('common.csatorna') },
  ];

  useEffect(() => {
    getAdminProperties().then((data) => setProperties(data.properties));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filterProperty !== "all") params.property_id = filterProperty;
    if (filterType !== "all") params.utility_type = filterType;
    getAdminReadings(Object.keys(params).length > 0 ? params : undefined)
      .then((data) => setReadings(data.readings))
      .finally(() => setLoading(false));
  }, [filterProperty, filterType]);

  const borderColor = (type: string) => {
    if (type === "villany") return "border-l-amber-400";
    if (type === "viz") return "border-l-blue-400";
    return "border-l-purple-400";
  };

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">{t('adminReadings.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('adminReadings.desc')}</p>
      </div>

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
                <TableRow key={r.id} className={`border-l-4 ${borderColor(r.utility_type)}`}>
                  <TableCell className="font-medium text-sm">{r.property_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{utilityLabel(r.utility_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm format-hu">
                    {formatNumber(r.value, 2)} {r.utility_type === "villany" ? "kWh" : "m\u00B3"}
                  </TableCell>
                  <TableCell className="text-right text-sm format-hu">
                    {r.consumption != null
                      ? `${formatNumber(r.consumption, 2)} ${r.utility_type === "villany" ? "kWh" : "m\u00B3"}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-display font-bold format-hu">
                    {r.cost_huf != null ? formatHuf(r.cost_huf) : "—"}
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
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default AdminReadings;
