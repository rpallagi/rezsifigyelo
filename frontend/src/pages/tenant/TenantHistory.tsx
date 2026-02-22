import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Zap, Droplets, Waves, Camera } from "lucide-react";
import { getTenantHistory, getTenantChartData, type ReadingItem } from "@/lib/api";
import { formatHuf, formatDate, formatDateShort, formatNumber } from "@/lib/format";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useI18n } from "@/lib/i18n";

type TabKey = "all" | "villany" | "viz" | "csatorna";

const utilityIcon = (type: string) => {
  if (type === 'villany') return <Zap className="h-3.5 w-3.5" style={{ color: "hsl(45, 93%, 47%)" }} />;
  if (type === 'viz') return <Droplets className="h-3.5 w-3.5" style={{ color: "hsl(199, 89%, 48%)" }} />;
  return <Waves className="h-3.5 w-3.5" style={{ color: "hsl(280, 60%, 55%)" }} />;
};

const utilityColor = (type: string) => {
  if (type === 'villany') return 'hsl(45, 93%, 47%)';
  if (type === 'viz') return 'hsl(199, 89%, 48%)';
  return 'hsl(280, 60%, 55%)';
};

const TenantHistory = () => {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type');
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialType && ['villany', 'viz', 'csatorna'].includes(initialType) ? initialType as TabKey : "all"
  );
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const tabKeys: TabKey[] = ["all", "villany", "viz", "csatorna"];
  const tabLabels: Record<TabKey, string> = {
    all: t('common.all'),
    villany: t('common.villany'),
    viz: t('common.viz'),
    csatorna: t('common.csatorna'),
  };

  useEffect(() => {
    const type = activeTab;
    setLoading(true);
    getTenantHistory(type)
      .then((data) => setReadings(data.readings))
      .finally(() => setLoading(false));

    Promise.all([
      getTenantChartData('villany', 12),
      getTenantChartData('viz', 12),
    ]).then(([v, w]) => {
      const merged: any[] = [];
      const maxLen = Math.max(v.labels.length, w.labels.length);
      for (let i = 0; i < maxLen; i++) {
        merged.push({
          month: v.labels[i] || w.labels[i] || '',
          villany: v.costs[i] || 0,
          viz: w.costs[i] || 0,
        });
      }
      setChartData(merged);
    });
  }, [activeTab]);

  // Calculate totals for the summary
  const totalCost = readings.reduce((sum, r) => sum + (r.cost_huf || 0), 0);
  const totalReadings = readings.length;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-2 mb-6 animate-in">
        <h1 className="font-display text-2xl font-bold">{t('history.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('history.desc')}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5 animate-in-delay-1">
        {tabKeys.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-5 animate-in-delay-1">
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('history.totalCost')}</p>
          <p className="font-display font-bold text-lg format-hu">{formatHuf(totalCost)}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{t('history.readings')}</p>
          <p className="font-display font-bold text-lg">{totalReadings} {t('common.db')}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-4 mb-5 animate-in-delay-2">
          <h3 className="font-display font-semibold text-sm mb-4">{t('history.monthlyCosts')}</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2} barCategoryGap="15%">
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={40}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: "11px",
                    boxShadow: "var(--shadow-md)",
                  }}
                  formatter={(value: number) => [formatHuf(value), ""]}
                />
                {(activeTab === "all" || activeTab === "villany") && (
                  <Bar dataKey="villany" name={t('common.villany')} fill="hsl(45, 93%, 47%)" radius={[4, 4, 0, 0]} />
                )}
                {(activeTab === "all" || activeTab === "viz") && (
                  <Bar dataKey="viz" name={t('common.viz')} fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Readings list */}
      <div className="space-y-2 animate-in-delay-3">
        <h3 className="font-display font-semibold text-sm mb-3">{t('history.readings')}</h3>
        {loading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="glass-card p-4 h-20 animate-pulse" />)}
          </div>
        )}
        {!loading && readings.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground text-sm">{t('history.noReadings')}</p>
          </div>
        )}
        {readings.map((r) => (
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
                <p className="font-medium text-sm capitalize">{r.utility_type}</p>
                {r.photo_filename && <Camera className="h-3 w-3 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(r.reading_date)}</p>
              {r.consumption != null && (
                <p className="text-xs text-muted-foreground">
                  {t('reading.consumption')}: {formatNumber(r.consumption)} {r.utility_type === 'villany' ? 'kWh' : 'm\u00B3'}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              {r.cost_huf != null && (
                <p className="font-display font-bold text-sm format-hu">{formatHuf(r.cost_huf)}</p>
              )}
              <p className="text-xs text-muted-foreground format-hu">
                {formatNumber(r.value)} {r.utility_type === 'villany' ? 'kWh' : 'm\u00B3'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TenantHistory;
