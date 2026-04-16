"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3, Table } from "lucide-react";

type ChartItem = {
  name: string;
  annualRent: number;
  monthlyRent: number;
  annualDisplay: string;
  monthlyDisplay: string;
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6", "#94a3b8"];

interface TooltipPayload {
  payload: ChartItem;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="text-sm font-semibold tracking-tight">{item.name}</p>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Éves bevétel</span>
          <span className="font-semibold tabular-nums">{item.annualDisplay}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Havi átlag</span>
          <span className="font-semibold tabular-nums">{item.monthlyDisplay}</span>
        </div>
      </div>
    </div>
  );
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function RevenueChart({ data }: { data: ChartItem[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nincs aktív bérlős ingatlan
      </div>
    );
  }

  const totalAnnual = data.reduce((acc, item) => acc + item.annualRent, 0);

  return (
    <div className="relative">
      {/* View toggle — top right */}
      <div className="absolute right-0 top-0 z-10 flex gap-1 rounded-xl border border-border/60 bg-background/80 p-0.5 backdrop-blur">
        <button
          type="button"
          onClick={() => setView("chart")}
          className={`rounded-lg p-1.5 transition ${
            view === "chart"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Grafikon nézet"
        >
          <BarChart3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setView("table")}
          className={`rounded-lg p-1.5 transition ${
            view === "table"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Táblázat nézet"
        >
          <Table className="h-4 w-4" />
        </button>
      </div>

      {view === "chart" && (
        <div className="h-80 w-full pt-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "currentColor" }}
                interval={0}
                angle={-25}
                textAnchor="end"
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: "currentColor" }}
                stroke="currentColor"
                className="text-muted-foreground"
                width={50}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(99,102,241,0.08)" }}
              />
              <Bar dataKey="annualRent" radius={[8, 8, 0, 0]} maxBarSize={64}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === "table" && (
        <div className="pt-10">
          <div className="overflow-hidden rounded-xl border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-3">Ingatlan</th>
                  <th className="px-4 py-3 text-right">Havi</th>
                  <th className="px-4 py-3 text-right">Éves</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Megoszlás</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => {
                  const pct = totalAnnual > 0 ? (item.annualRent / totalAnnual) * 100 : 0;
                  return (
                    <tr key={item.name} className="border-t border-border/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.monthlyDisplay}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {item.annualDisplay}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
