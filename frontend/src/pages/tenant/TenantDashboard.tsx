import { useEffect, useState } from "react";
import { Zap, Droplets, TrendingUp, TrendingDown, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getTenantDashboard, tenantLogout, type TenantDashboardData } from "@/lib/api";
import { formatHuf } from "@/lib/format";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TenantDashboard = () => {
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getTenantDashboard()
      .then(setData)
      .catch(() => navigate("/tenant/login"))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await tenantLogout().catch(() => {});
    navigate("/tenant/login");
  };

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4 pt-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const villanyConsumption = data.last_villany?.consumption;
  const villanyiCost = data.last_villany?.cost_huf;
  const vizConsumption = data.last_viz?.consumption;
  const vizCost = data.last_viz?.cost_huf;
  const csatornaCost = vizConsumption && data.tariffs.csatorna
    ? vizConsumption * data.tariffs.csatorna.rate_huf : 0;

  const cards = [
    {
      label: "Villany",
      icon: Zap,
      color: "hsl(45, 93%, 47%)",
      value: data.last_villany?.value,
      consumption: villanyConsumption,
      cost: villanyiCost,
      unit: "kWh",
      date: data.last_villany?.reading_date,
      sparkline: data.sparklines?.villany || [],
    },
    {
      label: "Víz",
      icon: Droplets,
      color: "hsl(199, 89%, 48%)",
      value: data.last_viz?.value,
      consumption: vizConsumption,
      cost: vizCost,
      unit: "m³",
      date: data.last_viz?.reading_date,
      sparkline: data.sparklines?.viz || [],
      extra: csatornaCost > 0 ? `+ csatorna: ${formatHuf(csatornaCost)}` : undefined,
    },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-2 mb-6 animate-in flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Üdv,</p>
          <h1 className="font-display text-2xl font-bold">{data.property.name}</h1>
          {data.property.address && (
            <p className="text-muted-foreground text-xs mt-1">{data.property.address}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Monthly total */}
      <div className="glass-card p-5 mb-5 animate-in-delay-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">Havi becsült költség</span>
        </div>
        <p className="font-display text-3xl font-bold format-hu">
          {formatHuf(data.monthly_total || ((villanyiCost || 0) + (vizCost || 0) + csatornaCost))}
        </p>
      </div>

      {/* Utility cards */}
      <div className="space-y-3 animate-in-delay-2">
        {cards.map((card) => (
          <div key={card.label} className="glass-card p-4 flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${card.color}20` }}
            >
              <card.icon className="h-5 w-5" style={{ color: card.color }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="font-display font-bold text-lg format-hu">
                {card.value != null ? `${card.value.toLocaleString('hu-HU')} ${card.unit}` : '—'}
              </p>
              {card.consumption != null && (
                <p className="text-xs text-muted-foreground">
                  Fogyasztás: {card.consumption.toLocaleString('hu-HU')} {card.unit}
                  {card.cost != null && ` ≈ ${formatHuf(card.cost)}`}
                </p>
              )}
              {card.extra && (
                <p className="text-xs text-muted-foreground">{card.extra}</p>
              )}
            </div>

            {card.sparkline.length > 1 && (
              <div className="w-20 h-10 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={card.sparkline.map((v, i) => ({ v, i }))}>
                    <defs>
                      <linearGradient id={`g-${card.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={card.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={card.color} strokeWidth={2} fill={`url(#g-${card.label})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tariff info */}
      <div className="mt-5 glass-card p-4 animate-in-delay-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Aktuális tarifák</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          {data.tariffs.villany && <p>⚡ Villany: {data.tariffs.villany.rate_huf.toLocaleString('hu-HU')} Ft/{data.tariffs.villany.unit}</p>}
          {data.tariffs.viz && <p>💧 Víz: {data.tariffs.viz.rate_huf.toLocaleString('hu-HU')} Ft/{data.tariffs.viz.unit}</p>}
          {data.tariffs.csatorna && <p>🚰 Csatorna: {data.tariffs.csatorna.rate_huf.toLocaleString('hu-HU')} Ft/{data.tariffs.csatorna.unit}</p>}
        </div>
      </div>

      <div className="mt-4 animate-in-delay-3">
        <p className="text-xs text-muted-foreground">
          Utolsó leolvasás: {data.last_villany?.reading_date || data.last_viz?.reading_date || '—'}
        </p>
      </div>
    </div>
  );
};

export default TenantDashboard;
