"use client";

import React from "react";
import { api } from "@/trpc/react";
import { Zap, Droplets, Flame, Waves } from "lucide-react";

const utilityLabels: Record<string, string> = {
  villany: "Villany", viz: "Víz", gaz: "Gáz", csatorna: "Csatorna",
};
const monthNames = ["", "Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];

function utilityIcon(type: string) {
  switch (type) {
    case "villany": return <Zap className="h-3 w-3" />;
    case "viz": case "csatorna": return <Droplets className="h-3 w-3" />;
    case "gaz": return <Flame className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function utilityColor(type: string) {
  switch (type) {
    case "villany": return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
    case "viz": case "csatorna": return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
    case "gaz": return "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300";
    default: return "bg-secondary text-muted-foreground";
  }
}

function formatCurrency(value?: number | null) {
  return value != null ? `${Math.round(value).toLocaleString("hu-HU")} Ft` : "—";
}

export function MonthlyConsumptionTable({ propertyId }: { propertyId: number }) {
  const { data: readings, isLoading } = api.reading.listAll.useQuery({
    propertyIds: [propertyId],
  });

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-secondary/30" />;
  }

  if (!readings || readings.length === 0) return null;

  // Group by month + utility, using virtualConsumption when available
  const monthMap = new Map<string, { month: string; utilityType: string; consumption: number; costHuf: number; isVirtual: boolean }>();
  for (const r of readings) {
    const cons = r.virtualConsumption ?? r.consumption;
    const cost = r.virtualCostHuf ?? r.costHuf;
    if (cons == null || cons <= 0) continue;
    const dateStr = typeof r.readingDate === "string" ? r.readingDate : (r.readingDate as Date).toISOString();
    const month = dateStr.substring(0, 7);
    const key = `${month}-${r.utilityType}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.consumption += cons;
      existing.costHuf += cost ?? 0;
    } else {
      monthMap.set(key, { month, utilityType: r.utilityType, consumption: cons, costHuf: cost ?? 0, isVirtual: r.virtualConsumption != null });
    }
  }

  const monthRows = [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month));
  const sections: { month: string; label: string; rows: typeof monthRows; total: number }[] = [];
  let cur = "";
  for (const row of monthRows) {
    if (row.month !== cur) {
      cur = row.month;
      const [y, m] = row.month.split("-");
      sections.push({ month: cur, label: `${y}. ${monthNames[Number(m)]}`, rows: [], total: 0 });
    }
    const sec = sections[sections.length - 1]!;
    sec.rows.push(row);
    sec.total += row.costHuf;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-muted-foreground">
            <th className="pb-2 font-medium">Közmű</th>
            <th className="pb-2 font-medium">Fogyasztás</th>
            <th className="pb-2 font-medium">Költség</th>
          </tr>
        </thead>
        <tbody>
          {sections.slice(0, 6).map((sec) => (
            <React.Fragment key={sec.month}>
              <tr>
                <td colSpan={3} className="pb-0.5 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{sec.label}</span>
                    {sec.total > 0 && <span className="text-[11px] font-medium text-muted-foreground">{formatCurrency(sec.total)}</span>}
                  </div>
                </td>
              </tr>
              {sec.rows.map((row) => (
                <tr key={`${row.month}-${row.utilityType}`} className="border-b border-border/30">
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-flex rounded-lg p-1 ${utilityColor(row.utilityType)}`}>
                        {utilityIcon(row.utilityType)}
                      </span>
                      {utilityLabels[row.utilityType] ?? row.utilityType}
                      {row.isVirtual && <span className="rounded bg-purple-100 dark:bg-purple-950/40 px-1 py-0.5 text-[9px] font-semibold text-purple-700 dark:text-purple-300">Számított</span>}
                    </span>
                  </td>
                  <td className={`py-1.5 font-mono tabular-nums ${row.isVirtual ? "text-purple-700 dark:text-purple-300" : ""}`}>
                    {row.consumption.toLocaleString("hu-HU", { maximumFractionDigits: 1 })}
                  </td>
                  <td className={`py-1.5 ${row.isVirtual ? "text-purple-700 dark:text-purple-300" : ""}`}>
                    {formatCurrency(row.costHuf)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
