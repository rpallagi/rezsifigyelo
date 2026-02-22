import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, Building2, Banknote, Wrench, CalendarClock, Percent,
  ChevronRight, ArrowRight,
} from "lucide-react";
import { getAdminROI, type ROIProperty } from "@/lib/api";
import { formatHuf, formatMonthYear, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/lib/i18n";

const AdminROI = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<ROIProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminROI()
      .then((data) => setProperties(data.properties))
      .finally(() => setLoading(false));
  }, []);

  const typeBadge = (type: string) => {
    if (type === "lakas")
      return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 text-xs">{t('common.lakas')}</Badge>;
    if (type === "uzlet")
      return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-xs">{t('common.uzlet')}</Badge>;
    return <Badge variant="outline" className="text-xs">{t('common.egyeb')}</Badge>;
  };

  const yieldColor = (y: number) => {
    if (y >= 8) return "text-green-600";
    if (y >= 5) return "text-amber-600";
    return "text-red-500";
  };

  const yieldBg = (y: number) => {
    if (y >= 8) return "bg-green-500";
    if (y >= 5) return "bg-amber-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">{t('roi.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('roi.desc')}</p>
      </div>

      {properties.length === 0 ? (
        <div className="glass-card p-12 text-center animate-in-delay-1">
          <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('roi.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in-delay-1">
          {properties.map((p) => {
            const sparkData = (p.monthly_payments || []).map((v, i) => ({ v, i }));
            const netIncome = (p.total_rent_collected || 0) - p.total_maintenance;

            return (
              <div key={p.id} className="glass-card overflow-hidden flex flex-col">
                {/* Header - clickable → properties page */}
                <div
                  className="p-5 flex items-center gap-3 cursor-pointer hover:bg-accent/30 transition-colors group"
                  onClick={() => navigate('/admin/properties')}
                >
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-sm">{p.name}</h3>
                    {typeBadge(p.property_type)}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>

                {/* Yield hero */}
                <div className="px-5 pb-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('roi.annualYield')}</p>
                      <p className={`font-display font-extrabold text-3xl ${yieldColor(p.annual_yield)}`}>
                        {formatNumber(p.annual_yield, 1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t('roi.netIncome')}</p>
                      <p className={`font-display font-bold text-sm ${netIncome >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatHuf(netIncome)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Income sparkline */}
                {sparkData.length > 1 && (
                  <div
                    className="h-20 px-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/admin/payments')}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData}>
                        <defs>
                          <linearGradient id={`roi-spark-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill={`url(#roi-spark-${p.id})`}
                          dot={false}
                          animationDuration={1200}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Stats grid - clickable sections */}
                <div className="grid grid-cols-2 gap-px bg-border/50">
                  <div
                    className="bg-card p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => navigate('/admin/properties')}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('roi.purchasePrice')}</p>
                    </div>
                    <p className="font-display font-bold text-sm format-hu">{formatHuf(p.purchase_price)}</p>
                  </div>

                  <div
                    className="bg-card p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => navigate('/admin/properties')}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('roi.monthlyRent')}</p>
                    </div>
                    <p className="font-display font-bold text-sm format-hu">{formatHuf(p.monthly_rent)}</p>
                  </div>

                  <div
                    className="bg-card p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => navigate('/admin/maintenance')}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('roi.totalMaintenance')}</p>
                    </div>
                    <p className="font-display font-bold text-sm format-hu">{formatHuf(p.total_maintenance)}</p>
                  </div>

                  <div
                    className="bg-card p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => navigate('/admin/payments')}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Banknote className="h-3.5 w-3.5 text-green-500" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('roi.totalCollected')}</p>
                    </div>
                    <p className="font-display font-bold text-sm format-hu text-green-600">{formatHuf(p.total_rent_collected || 0)}</p>
                  </div>
                </div>

                {/* Break-even progress bar */}
                <div className="p-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{t('roi.breakeven')}</p>
                    </div>
                    <p className="font-display font-bold text-sm">
                      {p.breakeven_months} {t('roi.months')}
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        ({formatNumber(p.breakeven_months / 12, 1)} {t('roi.years')})
                      </span>
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${yieldBg(p.annual_yield)}`}
                      style={{ width: `${Math.min(p.progress_pct || 0, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatNumber(p.progress_pct || 0, 1)}%</span>
                    <span>{formatMonthYear(p.breakeven_date)}</span>
                  </div>
                </div>

                {/* Quick nav footer */}
                <div className="grid grid-cols-3 gap-px bg-border/50 border-t border-border/50">
                  <button
                    className="bg-card p-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors flex items-center justify-center gap-1"
                    onClick={() => navigate('/admin/properties')}
                  >
                    <Building2 className="h-3 w-3" />
                    {t('roi.viewProperty')}
                  </button>
                  <button
                    className="bg-card p-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors flex items-center justify-center gap-1"
                    onClick={() => navigate('/admin/payments')}
                  >
                    <Banknote className="h-3 w-3" />
                    {t('roi.viewPayments')}
                  </button>
                  <button
                    className="bg-card p-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors flex items-center justify-center gap-1"
                    onClick={() => navigate('/admin/maintenance')}
                  >
                    <Wrench className="h-3 w-3" />
                    {t('roi.viewMaintenance')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminROI;
