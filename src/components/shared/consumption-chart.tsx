"use client";

import { useState } from "react";
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

type Period = "6m" | "1y" | "all";

export function ConsumptionChart({ readings }: { readings: Reading[] }) {
  const { intlLocale, messages, utilityLabel } = useLocale();
  const [period, setPeriod] = useState<Period>("1y");

  // Group by month and utility
  const byMonth = new Map<string, Record<string, number>>();

  for (const r of readings) {
    if (r.consumption == null || r.consumption <= 0) continue;
    const month = r.readingDate.slice(0, 7); // YYYY-MM
    const existing = byMonth.get(month) ?? {};
    existing[r.utilityType] = (existing[r.utilityType] ?? 0) + r.consumption;
    byMonth.set(month, existing);
  }

  const allData = Array.from(byMonth.entries())
    .map(([month, values]) => ({ month, ...values }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const sliceCount = period === "6m" ? 6 : period === "1y" ? 12 : allData.length;
  const data = allData.slice(-sliceCount);

  if (data.length < 2) return null;

  const utilityTypes = [...new Set(readings.map((r) => r.utilityType))];

  const periods: { key: Period; label: string }[] = [
    { key: "6m", label: "6 hó" },
    { key: "1y", label: "1 év" },
    { key: "all", label: "Összes" },
  ];

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{messages.chart.title}</h2>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
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
