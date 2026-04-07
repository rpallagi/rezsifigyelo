"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useLocale } from "@/components/providers/locale-provider";

type Reading = {
  readingDate: string;
  consumption: number | null;
  utilityType: string;
};

const utilityColors: Record<string, string> = {
  villany: "#eab308",
  viz: "#3b82f6",
  gaz: "#ef4444",
  csatorna: "#8b5cf6",
};

export function ConsumptionChart({ readings }: { readings: Reading[] }) {
  const { intlLocale, messages, utilityLabel } = useLocale();
  // Group by month and utility
  const byMonth = new Map<string, Record<string, number>>();

  for (const r of readings) {
    if (r.consumption == null || r.consumption <= 0) continue;
    const month = r.readingDate.slice(0, 7); // YYYY-MM
    const existing = byMonth.get(month) ?? {};
    existing[r.utilityType] = (existing[r.utilityType] ?? 0) + r.consumption;
    byMonth.set(month, existing);
  }

  const data = Array.from(byMonth.entries())
    .map(([month, values]) => ({ month, ...values }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12); // Last 12 months

  if (data.length < 2) return null;

  const utilityTypes = [...new Set(readings.map((r) => r.utilityType))];

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">{messages.chart.title}</h2>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              tickFormatter={(v: string) => {
                return new Intl.DateTimeFormat(intlLocale, {
                  month: "short",
                }).format(new Date(`${v}-01`));
              }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            {utilityTypes.map((type) => (
              <Area
                key={type}
                type="monotone"
                dataKey={type}
                stackId="1"
                stroke={utilityColors[type] ?? "#6b7280"}
                fill={utilityColors[type] ?? "#6b7280"}
                fillOpacity={0.3}
                name={utilityLabel(type)}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
