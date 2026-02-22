import { useEffect, useState } from "react";
import { Building2, Users, Banknote, ListTodo, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminDashboard, type AdminDashboardData } from "@/lib/api";
import { formatHuf, formatDate, utilityLabel } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

const AdminDashboard = () => {
  const { t } = useI18n();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getAdminDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const stats = [
    { label: t('adminDash.properties'), value: String(data.total_properties), icon: Building2, href: "/admin/properties" },
    { label: t('adminDash.readings'), value: String(data.total_readings), icon: Users, href: "/admin/readings" },
    { label: t('adminDash.payments'), value: formatHuf(data.total_payments), icon: Banknote, href: "/admin/payments" },
    { label: t('adminDash.openTodos'), value: String(data.pending_todos), icon: ListTodo, href: "/admin/todos" },
  ];

  const typeBadge = (type: string) => {
    if (type === 'lakas') return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 text-xs">{t('common.lakas')}</Badge>;
    if (type === 'uzlet') return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-xs">{t('common.uzlet')}</Badge>;
    return <Badge variant="outline" className="text-xs">{t('common.egyeb')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">{t('adminDash.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('adminDash.desc')}</p>
      </div>

      {/* Stat cards - clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in-delay-1">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.href} className="block">
            <div className="stat-card hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer relative group">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-muted-foreground mt-3">{stat.label}</p>
              <p className="font-display font-bold text-xl format-hu">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Properties table - clickable rows */}
        <div className="lg:col-span-3 glass-card animate-in-delay-2">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-display font-bold">{t('adminDash.properties')}</h2>
            <Link to="/admin/properties" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              {t('common.all')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminDash.name')}</TableHead>
                <TableHead>{t('adminDash.type')}</TableHead>
                <TableHead className="text-right">{t('adminDash.monthlyRent')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.properties.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate('/admin/properties')}
                >
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell>{typeBadge(p.property_type)}</TableCell>
                  <TableCell className="text-right text-sm format-hu">
                    {p.monthly_rent ? formatHuf(p.monthly_rent) : '\u2014'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Recent readings - clickable rows */}
        <div className="lg:col-span-2 glass-card animate-in-delay-3">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-display font-bold">{t('adminDash.recentReadings')}</h2>
            <Link to="/admin/readings" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              {t('common.all')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/50">
            {data.recent_readings.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/admin/readings')}
              >
                <div>
                  <p className="font-medium text-sm">{utilityLabel(r.utility_type)}</p>
                  <p className="text-xs text-muted-foreground">{r.property_name} · {formatDate(r.reading_date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-sm format-hu">
                    {r.cost_huf != null ? formatHuf(r.cost_huf) : '\u2014'}
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
