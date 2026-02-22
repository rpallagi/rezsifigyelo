import { useState, useEffect } from "react";
import { getTenantHistory, getTenantChartData, type ReadingItem, type ChartData } from "@/lib/api";
import { formatHuf, formatDate, utilityLabel } from "@/lib/format";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const tabs = ["Összes", "Villany", "Víz", "Csatorna"] as const;
type Tab = typeof tabs[number];
const typeMap: Record<Tab, string> = { "Összes": "all", "Villany": "villany", "Víz": "viz", "Csatorna": "csatorna" };

const TenantHistory = () => {
  const [activeTab, setActiveTab] = useState<Tab>("Összes");
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const type = typeMap[activeTab];
    setLoading(true);
    getTenantHistory(type)
      .then((data) => setReadings(data.readings))
      .finally(() => setLoading(false));

    // Get chart data for all types
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

  const borderColor = (type: string) => {
    if (type === 'villany') return 'border-l-amber-400';
    if (type === 'viz') return 'border-l-blue-400';
    return 'border-l-purple-400';
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-2 mb-6 animate-in">
        <h1 className="font-display text-2xl font-bold">Előzmények</h1>
        <p className="text-muted-foreground text-sm mt-1">Fogyasztás és költségek áttekintése</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-6 animate-in-delay-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-4 mb-6 animate-in-delay-2">
          <h3 className="font-display font-semibold text-sm mb-4">Havi költségek (Ft)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: "12px" }}
                  formatter={(value: number) => [formatHuf(value), ""]}
                />
                {(activeTab === "Összes" || activeTab === "Villany") && (
                  <Bar dataKey="villany" name="Villany" fill="hsl(45, 93%, 47%)" radius={[4, 4, 0, 0]} />
                )}
                {(activeTab === "Összes" || activeTab === "Víz") && (
                  <Bar dataKey="viz" name="Víz" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Readings list */}
      <div className="space-y-2 animate-in-delay-3">
        <h3 className="font-display font-semibold text-sm mb-3">Leolvasások</h3>
        {loading && <p className="text-muted-foreground text-sm">Betöltés...</p>}
        {!loading && readings.length === 0 && <p className="text-muted-foreground text-sm">Még nincs mérőállás rögzítve.</p>}
        {readings.map((r) => (
          <div key={r.id} className={`glass-card p-4 flex items-center justify-between border-l-4 ${borderColor(r.utility_type)}`}>
            <div>
              <p className="font-medium text-sm">{utilityLabel(r.utility_type)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(r.reading_date)}</p>
              {r.consumption != null && (
                <p className="text-xs text-muted-foreground">
                  Fogyasztás: {r.consumption.toLocaleString('hu-HU')} {r.utility_type === 'villany' ? 'kWh' : 'm³'}
                </p>
              )}
            </div>
            <div className="text-right">
              {r.cost_huf != null && <p className="font-display font-bold text-sm format-hu">{formatHuf(r.cost_huf)}</p>}
              <p className="text-xs text-muted-foreground format-hu">
                {r.value.toLocaleString('hu-HU')} {r.utility_type === 'villany' ? 'kWh' : 'm³'}
              </p>
              {r.photo_filename && <span className="text-xs text-muted-foreground">Foto</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TenantHistory;
