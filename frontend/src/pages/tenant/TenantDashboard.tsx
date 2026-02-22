import { useEffect, useState } from "react";
import { Zap, Droplets, Waves, TrendingUp, TrendingDown, LogOut, PlusCircle, ChevronRight, Calendar, ClipboardEdit } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { getTenantDashboard, tenantLogout, type TenantDashboardData } from "@/lib/api";
import { formatHuf, formatNumber, formatDateShort } from "@/lib/format";
import { Area, AreaChart, ResponsiveContainer, Bar, BarChart, XAxis, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";

const TenantDashboard = () => {
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useI18n();

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
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const villanyConsumption = data.last_villany?.consumption ?? 0;
  const villanyCost = data.last_villany?.cost_huf ?? 0;
  const vizConsumption = data.last_viz?.consumption ?? 0;
  const vizCost = data.last_viz?.cost_huf ?? 0;
  const csatornaRate = data.tariffs?.csatorna?.rate_huf ?? 0;
  const csatornaCost = vizConsumption * csatornaRate;
  const monthlyTotal = data.monthly_total || (villanyCost + vizCost + csatornaCost);

  const villanySparkline = data.sparklines?.villany || [];
  const vizSparkline = data.sparklines?.viz || [];

  const barData = villanySparkline.slice(-6).map((v, i) => ({
    label: `${i + 1}`,
    villany: v,
    viz: vizSparkline[vizSparkline.length - 6 + i] || 0,
  }));

  const statCards = [
    {
      label: t('common.villany'),
      type: "villany",
      icon: Zap,
      color: "hsl(45, 93%, 47%)",
      bgColor: "hsl(45, 93%, 47%)",
      consumption: villanyConsumption,
      cost: villanyCost,
      unit: "kWh",
      value: data.last_villany?.value,
      sparkline: villanySparkline,
      date: data.last_villany?.reading_date,
    },
    {
      label: t('common.viz'),
      type: "viz",
      icon: Droplets,
      color: "hsl(199, 89%, 48%)",
      bgColor: "hsl(199, 89%, 48%)",
      consumption: vizConsumption,
      cost: vizCost,
      unit: "m\u00B3",
      value: data.last_viz?.value,
      sparkline: vizSparkline,
      date: data.last_viz?.reading_date,
    },
    {
      label: t('common.csatorna'),
      type: "csatorna",
      icon: Waves,
      color: "hsl(280, 60%, 55%)",
      bgColor: "hsl(280, 60%, 55%)",
      consumption: vizConsumption,
      cost: csatornaCost,
      unit: "m\u00B3",
      value: null,
      sparkline: vizSparkline,
      date: data.last_viz?.reading_date,
    },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-2 mb-5 animate-in flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{t('tenant.welcome')}</p>
          <h1 className="font-display text-2xl font-bold">{data.property.name}</h1>
          {data.property.address && (
            <p className="text-muted-foreground text-xs mt-0.5">{data.property.address}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground h-9 w-9">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ★ PRIMARY ACTION: New Meter Reading - TOP of page */}
      <Link to="/tenant/reading" className="block mb-5 animate-in">
        <div className="relative overflow-hidden rounded-2xl gradient-primary-bg p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <ClipboardEdit className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold text-lg text-primary-foreground">{t('tenant.readingCta')}</p>
              <p className="text-primary-foreground/70 text-sm mt-0.5">{t('tenant.readingCtaDesc')}</p>
            </div>
            <ChevronRight className="h-6 w-6 text-primary-foreground/60 flex-shrink-0" />
          </div>
        </div>
      </Link>

      {/* Hero: Monthly Total Card - clickable → history */}
      <Link to="/tenant/history" className="block mb-5 animate-in-delay-1">
        <div className="glass-card-hover p-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-[0.07]"
            style={{ background: "var(--gradient-primary)" }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-medium">{t('tenant.monthlyCost')}</span>
              <div className="flex items-center gap-2">
                {data.last_villany?.reading_date && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateShort(data.last_villany.reading_date)}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="font-display text-4xl font-extrabold tracking-tight format-hu mb-4">
              {formatHuf(monthlyTotal)}
            </p>

            {/* Mini breakdown pills */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: "hsl(45, 93%, 47%, 0.12)", color: "hsl(45, 93%, 47%)" }}>
                <Zap className="h-3 w-3" />
                {formatHuf(villanyCost)}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: "hsl(199, 89%, 48%, 0.12)", color: "hsl(199, 89%, 48%)" }}>
                <Droplets className="h-3 w-3" />
                {formatHuf(vizCost)}
              </span>
              {csatornaCost > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: "hsl(280, 60%, 55%, 0.12)", color: "hsl(280, 60%, 55%)" }}>
                  <Waves className="h-3 w-3" />
                  {formatHuf(csatornaCost)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* 3-column stat cards - clickable → history with type filter */}
      <div className="grid grid-cols-3 gap-3 mb-5 animate-in-delay-1">
        {statCards.map((card) => (
          <Link key={card.label} to={`/tenant/history?type=${card.type}`} className="block">
            <div className="glass-card-hover p-3 text-center h-full">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: `${card.bgColor}20` }}
              >
                <card.icon className="h-4 w-4" style={{ color: card.color }} />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{card.label}</p>
              <p className="font-display font-bold text-sm format-hu">
                {formatNumber(card.consumption)} {card.unit}
              </p>
              <p className="text-[10px] text-muted-foreground format-hu">
                {formatHuf(card.cost)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Utility detail cards with sparklines - clickable → history with type */}
      <div className="space-y-3 mb-5 animate-in-delay-2">
        {statCards.filter(c => c.type !== "csatorna").map((card) => (
          <Link key={card.label} to={`/tenant/history?type=${card.type}`} className="block">
            <div className="glass-card-hover p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${card.bgColor}15` }}
                  >
                    <card.icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-sm">{card.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {card.date ? formatDateShort(card.date) : t('common.noData')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-display font-bold format-hu">{formatHuf(card.cost)}</p>
                    <p className="text-xs text-muted-foreground format-hu">
                      {formatNumber(card.consumption)} {card.unit}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>

              {/* Sparkline */}
              {card.sparkline.length > 1 && (
                <div className="h-16 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={card.sparkline.map((v, i) => ({ v, i }))}>
                      <defs>
                        <linearGradient id={`spark-${card.label}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={card.color}
                        strokeWidth={2}
                        fill={`url(#spark-${card.label})`}
                        dot={false}
                        animationDuration={1200}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Reading details */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground">
                  <span>{t('tenant.meterValue')}: </span>
                  <span className="font-medium text-foreground">
                    {card.value != null ? `${formatNumber(card.value)} ${card.unit}` : "\u2014"}
                  </span>
                </div>
                {data.tariffs[card.type as 'villany' | 'viz'] && (
                  <div className="text-xs text-muted-foreground">
                    {data.tariffs[card.type as 'villany' | 'viz']!.rate_huf.toLocaleString("hu-HU")} {t('common.ft')}/{card.unit}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick overview bar chart */}
      {barData.length > 1 && (
        <div className="glass-card p-4 mb-5 animate-in-delay-3">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-semibold text-sm">{t('tenant.lastMonths')}</p>
            <Link to="/tenant/history" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              {t('common.details')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barGap={2} barCategoryGap="20%">
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: "11px",
                    boxShadow: "var(--shadow-md)",
                  }}
                  formatter={(value: number, name: string) => [
                    `${formatNumber(value)} ${name === "villany" ? "kWh" : "m\u00B3"}`,
                    name === "villany" ? t('common.villany') : t('common.viz'),
                  ]}
                />
                <Bar dataKey="villany" fill="hsl(45, 93%, 47%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="viz" fill="hsl(199, 89%, 48%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tariff info - compact (stays static) */}
      <div className="glass-card p-4 animate-in-delay-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t('tenant.currentTariffs')}</p>
        <div className="grid grid-cols-3 gap-3">
          {data.tariffs.villany && (
            <div className="text-center">
              <Zap className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: "hsl(45, 93%, 47%)" }} />
              <p className="text-xs font-medium format-hu">{data.tariffs.villany.rate_huf.toLocaleString("hu-HU")} {t('common.ft')}</p>
              <p className="text-[10px] text-muted-foreground">/{data.tariffs.villany.unit}</p>
            </div>
          )}
          {data.tariffs.viz && (
            <div className="text-center">
              <Droplets className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: "hsl(199, 89%, 48%)" }} />
              <p className="text-xs font-medium format-hu">{data.tariffs.viz.rate_huf.toLocaleString("hu-HU")} {t('common.ft')}</p>
              <p className="text-[10px] text-muted-foreground">/{data.tariffs.viz.unit}</p>
            </div>
          )}
          {data.tariffs.csatorna && (
            <div className="text-center">
              <Waves className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: "hsl(280, 60%, 55%)" }} />
              <p className="text-xs font-medium format-hu">{data.tariffs.csatorna.rate_huf.toLocaleString("hu-HU")} {t('common.ft')}</p>
              <p className="text-[10px] text-muted-foreground">/{data.tariffs.csatorna.unit}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;
