import { useEffect, useState } from "react";
import { Building2, Users, Banknote, ListTodo, TrendingUp, TrendingDown } from "lucide-react";
import { getAdminDashboard, type AdminDashboardData } from "@/lib/api";
import { formatHuf, formatDate, utilityLabel } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const AdminDashboard = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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
    { label: "Ingatlanok", value: String(data.total_properties), icon: Building2 },
    { label: "Mérőállások", value: String(data.total_readings), icon: Users },
    { label: "Befizetések összesen", value: formatHuf(data.total_payments), icon: Banknote },
    { label: "Nyitott feladatok", value: String(data.pending_todos), icon: ListTodo },
  ];

  const typeBadge = (type: string) => {
    if (type === 'lakas') return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">Lakás</Badge>;
    if (type === 'uzlet') return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">Üzlet</Badge>;
    return <Badge variant="outline" className="text-xs">Egyéb</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Áttekintés a portfóliódról</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in-delay-1">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <stat.icon className="h-5 w-5 text-accent-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="font-display font-bold text-xl format-hu">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Properties table */}
        <div className="lg:col-span-3 glass-card animate-in-delay-2">
          <div className="p-5 border-b border-border/50">
            <h2 className="font-display font-bold">Ingatlanok</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Név</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead className="text-right">Bérleti díj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell>{typeBadge(p.property_type)}</TableCell>
                  <TableCell className="text-right text-sm format-hu">
                    {p.monthly_rent ? formatHuf(p.monthly_rent) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Recent readings */}
        <div className="lg:col-span-2 glass-card animate-in-delay-3">
          <div className="p-5 border-b border-border/50">
            <h2 className="font-display font-bold">Legutóbbi leolvasások</h2>
          </div>
          <div className="divide-y divide-border/50">
            {data.recent_readings.slice(0, 8).map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{utilityLabel(r.utility_type)}</p>
                  <p className="text-xs text-muted-foreground">{r.property_name} · {formatDate(r.reading_date)}</p>
                </div>
                <p className="font-display font-bold text-sm format-hu">
                  {r.cost_huf != null ? formatHuf(r.cost_huf) : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
