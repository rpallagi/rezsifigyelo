import React from "react";
import { api } from "@/trpc/server";
import Link from "next/link";
import { Zap, Droplets, Flame, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Sparkline } from "@/components/shared/sparkline";
import { ConsumptionChart } from "@/components/shared/consumption-chart";
import { ClickableRow, ClickableCard } from "./reading-row";
import { NewReadingDropdown } from "./new-reading-dropdown";

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Víz",
  gaz: "Gáz",
  csatorna: "Csatorna",
  internet: "Internet",
  kozos_koltseg: "Közös költség",
  egyeb: "Egyéb",
};

const utilityUnits: Record<string, string> = {
  villany: "kWh",
  viz: "m³",
  gaz: "m³",
  csatorna: "m³",
  internet: "",
  kozos_koltseg: "Ft",
  egyeb: "",
};

const sourceLabels: Record<string, string> = {
  manual: "Kézi",
  tenant: "Bérlő",
  smart_mqtt: "Okos mérő",
  smart_ttn: "TTN",
  home_assistant: "Home Assistant",
};

function sourceLabel(source: string) {
  return sourceLabels[source] ?? source;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
}

function utilityIcon(type: string) {
  switch (type) {
    case "villany":
      return <Zap className="h-5 w-5" />;
    case "viz":
    case "csatorna":
      return <Droplets className="h-5 w-5" />;
    case "gaz":
      return <Flame className="h-5 w-5" />;
    default:
      return <Zap className="h-5 w-5" />;
  }
}

function utilityColor(type: string) {
  switch (type) {
    case "villany":
      return {
        bg: "bg-amber-100 dark:bg-amber-950/30",
        text: "text-amber-700 dark:text-amber-300",
        ring: "ring-amber-200/60 dark:ring-amber-800/40",
      };
    case "viz":
    case "csatorna":
      return {
        bg: "bg-blue-100 dark:bg-blue-950/30",
        text: "text-blue-700 dark:text-blue-300",
        ring: "ring-blue-200/60 dark:ring-blue-800/40",
      };
    case "gaz":
      return {
        bg: "bg-orange-100 dark:bg-orange-950/30",
        text: "text-orange-700 dark:text-orange-300",
        ring: "ring-orange-200/60 dark:ring-orange-800/40",
      };
    default:
      return {
        bg: "bg-secondary",
        text: "text-foreground",
        ring: "ring-border/60",
      };
  }
}

function formatCurrency(value?: number | null) {
  return value != null ? `${value.toLocaleString("hu-HU")} Ft` : "—";
}

type Reading = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  utilityType: string;
  meterInfoId: number | null;
  meterSerialNumber: string | null;
  meterLocation: string | null;
  meterType: string | null;
  tariffGroupId: number | null;
  value: number;
  consumption: number | null;
  costHuf: number | null;
  readingDate: string;
  source: string;
  virtualConsumption: number | null;
  virtualCostHuf: number | null;
};

function computeTrendCards(readings: Reading[]) {
  const utilityTypes = ["villany", "viz", "gaz"] as const;

  return utilityTypes.map((type) => {
    const typeReadings = readings
      .filter((r) => r.utilityType === type)
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate));

    const latest = typeReadings[0];
    const previous = typeReadings[1];

    let changePercent: number | null = null;
    if (
      latest?.consumption != null &&
      previous?.consumption != null &&
      previous.consumption > 0
    ) {
      changePercent =
        ((latest.consumption - previous.consumption) / previous.consumption) *
        100;
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyCost = typeReadings
      .filter((r) => r.readingDate.startsWith(currentMonth))
      .reduce((sum, r) => sum + (r.costHuf ?? 0), 0);

    const sparkData = typeReadings
      .filter((r) => r.consumption != null && r.consumption > 0)
      .slice(0, 12)
      .reverse()
      .map((r) => r.consumption!);

    return {
      type,
      label: utilityLabels[type] ?? type,
      unit: utilityUnits[type] ?? "",
      latestConsumption: latest?.consumption ?? null,
      changePercent,
      monthlyCost,
      sparkData,
    };
  });
}

export default async function AllReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; properties?: string; view?: string; period?: string }>;
}) {
  const params = await searchParams;
  const viewMode = params.view === "monthly" ? "monthly" : params.view === "yearly" ? "yearly" : "readings";
  const period = params.period ?? "3m";

  // Property selection — single or multi
  const selectedPropertyIds: number[] = params.properties
    ? params.properties.split(",").map(Number).filter(Boolean)
    : params.property
      ? [Number(params.property)]
      : [];

  // Calculate date range from period
  const periodMonths: Record<string, number> = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };
  const months = periodMonths[period];
  let fromDate: string | undefined;
  if (months) {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    fromDate = d.toISOString().split("T")[0];
  }

  const [allReadings, propertyList] = await Promise.all([
    api.reading.listAll({
      fromDate,
      propertyIds: selectedPropertyIds.length > 0 ? selectedPropertyIds : undefined,
    }),
    api.property.list(),
  ]);

  const filteredReadings = allReadings;
  const trendCards = computeTrendCards(filteredReadings);

  // Group readings by property
  const readingsByProperty = new Map<
    number,
    { propertyName: string; readings: Reading[] }
  >();
  for (const r of filteredReadings) {
    const existing = readingsByProperty.get(r.propertyId);
    if (existing) {
      existing.readings.push(r);
    } else {
      readingsByProperty.set(r.propertyId, {
        propertyName: r.propertyName ?? "Ismeretlen ingatlan",
        readings: [r],
      });
    }
  }

  // URL builder helper
  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      view: viewMode !== "readings" ? viewMode : undefined,
      period: period !== "3m" ? period : undefined,
      properties: selectedPropertyIds.length > 0 ? selectedPropertyIds.join(",") : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/readings${qs ? `?${qs}` : ""}`;
  };

  // Property grouping for filter pills (by building parent)
  const propertyGroups: { label: string; ids: number[]; children: { id: number; name: string }[] }[] = [];
  const seenIds = new Set<number>();
  // 1) Group by buildingPropertyId
  const parentMap = new Map<number, typeof propertyList>();
  for (const p of propertyList) {
    if (p.buildingPropertyId) {
      if (!parentMap.has(p.buildingPropertyId)) parentMap.set(p.buildingPropertyId, []);
      parentMap.get(p.buildingPropertyId)!.push(p);
    }
  }
  for (const [parentId, children] of parentMap) {
    const parent = propertyList.find((p) => p.id === parentId);
    const allInGroup = parent ? [parent, ...children.filter((c) => c.id !== parentId)] : children;
    if (allInGroup.length >= 2) {
      propertyGroups.push({
        label: parent?.address ?? parent?.name ?? children[0]!.name,
        ids: allInGroup.map((p) => p.id),
        children: allInGroup.map((p) => ({ id: p.id, name: p.name })),
      });
      allInGroup.forEach((p) => seenIds.add(p.id));
    }
  }
  // 2) Standalone properties
  for (const p of propertyList) {
    if (!seenIds.has(p.id)) {
      propertyGroups.push({ label: p.name, ids: [p.id], children: [] });
    }
  }

  // Summary stats for the selected period
  const totalConsumption: Record<string, number> = {};
  const totalCost: Record<string, number> = {};
  let grandTotalCost = 0;
  for (const r of filteredReadings) {
    const cons = r.virtualConsumption ?? r.consumption;
    const cost = r.virtualCostHuf ?? r.costHuf;
    if (cons != null && cons > 0) {
      totalConsumption[r.utilityType] = (totalConsumption[r.utilityType] ?? 0) + cons;
    }
    if (cost != null && cost > 0) {
      totalCost[r.utilityType] = (totalCost[r.utilityType] ?? 0) + cost;
      grandTotalCost += cost;
    }
  }
  const dayCount = months ? months * 30 : Math.max(1, Math.round((Date.now() - new Date(filteredReadings[filteredReadings.length - 1]?.readingDate ?? Date.now()).getTime()) / 86400000));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Leolvasások
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredReadings.length} leolvasás
            {selectedPropertyIds.length === 0
              ? " · összes ingatlan"
              : ` · ${selectedPropertyIds.length} ingatlan`}
          </p>
        </div>
        <NewReadingDropdown
          properties={propertyList.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address ?? null,
          }))}
        />
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "1m", label: "1 hónap" },
          { key: "3m", label: "3 hónap" },
          { key: "6m", label: "6 hónap" },
          { key: "1y", label: "1 év" },
          { key: "all", label: "Összes" },
        ].map((p) => (
          <Link
            key={p.key}
            href={buildUrl({ period: p.key === "3m" ? undefined : p.key })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              period === p.key
                ? "bg-foreground text-background"
                : "border border-border/70 bg-card text-foreground hover:bg-secondary"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["villany", "viz", "gaz"] as const).map((type) => {
          const cons = totalConsumption[type] ?? 0;
          const cost = totalCost[type] ?? 0;
          if (cons === 0 && cost === 0) return null;
          const colors = utilityColor(type);
          const card = trendCards.find((c) => c.type === type);
          return (
            <div key={type} className="rounded-[24px] border border-border/60 bg-card/90 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className={`inline-flex rounded-xl p-2 ${colors.bg} ${colors.text}`}>
                  {utilityIcon(type)}
                </div>
                {card?.changePercent != null && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    card.changePercent < 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : card.changePercent > 0
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                        : "bg-secondary text-muted-foreground"
                  }`}>
                    {card.changePercent < 0 ? <TrendingDown className="h-3 w-3" /> : card.changePercent > 0 ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {Math.abs(card.changePercent).toFixed(0)}%
                  </span>
                )}
              </div>
              {card && card.sparkData.length >= 2 && (
                <div className="mt-2">
                  <Sparkline data={card.sparkData} color={type === "villany" ? "#eab308" : type === "gaz" ? "#ef4444" : "#3b82f6"} height={32} />
                </div>
              )}
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {utilityLabels[type]}
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {cons.toLocaleString("hu-HU", { maximumFractionDigits: 0 })} {utilityUnits[type]}
              </p>
              <p className="text-sm text-muted-foreground">{formatCurrency(cost)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                ~{Math.round(cons / dayCount)} {utilityUnits[type]}/nap
              </p>
            </div>
          );
        }).filter(Boolean)}
        {/* Grand total cost card */}
        {grandTotalCost > 0 && (
          <div className="rounded-[24px] border border-border/60 bg-card/90 p-5 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Összköltség</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatCurrency(grandTotalCost)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ~{formatCurrency(grandTotalCost / (months ?? 12))}/hó
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              ~{formatCurrency(grandTotalCost / dayCount)}/nap
            </p>
          </div>
        )}
      </div>

      {/* Consumption chart */}
      <div className="rounded-[24px] border border-border/60 bg-card/90 p-5 shadow-sm">
        <ConsumptionChart
          readings={filteredReadings.map((r) => ({
            readingDate: typeof r.readingDate === "string" ? r.readingDate : (r.readingDate as Date).toISOString(),
            consumption: r.virtualConsumption ?? r.consumption,
            utilityType: r.utilityType,
          }))}
        />
      </div>

      {/* View mode + Property filter */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {(["readings", "monthly", "yearly"] as const).map((v) => (
            <Link
              key={v}
              href={buildUrl({ view: v === "readings" ? undefined : v })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                viewMode === v
                  ? "bg-foreground text-background"
                  : "border border-border/70 bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {v === "readings" ? "Leolvasások" : v === "monthly" ? "Havi" : "Éves"}
            </Link>
          ))}
        </div>

        {/* Property filter pills — grouped by parent */}
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={buildUrl({ properties: undefined })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              selectedPropertyIds.length === 0
                ? "bg-primary text-primary-foreground"
                : "border border-border/70 bg-card text-foreground hover:bg-secondary"
            }`}
          >
            Összes
          </Link>
          {propertyGroups.map((group) => {
            const isGroupSelected = group.ids.every((id) => selectedPropertyIds.includes(id));
            const isPartial = !isGroupSelected && group.ids.some((id) => selectedPropertyIds.includes(id));
            return (
              <React.Fragment key={group.label}>
                <Link
                  href={buildUrl({ properties: group.ids.join(",") })}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    isGroupSelected
                      ? "bg-primary text-primary-foreground"
                      : isPartial
                        ? "bg-primary/30 text-primary border border-primary/40"
                        : "border border-border/70 bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  {group.label} {group.children.length > 0 ? `(${group.ids.length})` : ""}
                </Link>
                {isPartial && group.children.map((child) => (
                  <Link
                    key={child.id}
                    href={buildUrl({ properties: String(child.id) })}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                      selectedPropertyIds.includes(child.id)
                        ? "bg-primary text-primary-foreground"
                        : "border border-border/50 bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {child.name}
                  </Link>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>


      {/* Monthly consumption view */}
      {viewMode === "monthly" && (() => {
        // Group by month + utility type
        type MonthRow = { month: string; utilityType: string; consumption: number; costHuf: number; count: number; propertyName: string; propertyId: number; isVirtual: boolean };
        const monthMap = new Map<string, MonthRow>();
        for (const r of filteredReadings) {
          const cons = r.virtualConsumption ?? r.consumption;
          const cost = r.virtualCostHuf ?? r.costHuf;
          if (cons == null || cons <= 0) continue;
          const month = r.readingDate.substring(0, 7); // "2026-04"
          const key = `${r.propertyId}-${month}-${r.utilityType}`;
          const existing = monthMap.get(key);
          if (existing) {
            existing.consumption += cons;
            existing.costHuf += cost ?? 0;
            existing.count++;
          } else {
            monthMap.set(key, {
              month,
              utilityType: r.utilityType,
              consumption: cons,
              costHuf: cost ?? 0,
              isVirtual: r.virtualConsumption != null,
              count: 1,
              propertyName: r.propertyName ?? "",
              propertyId: r.propertyId,
            });
          }
        }
        const monthRows = [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month) || a.propertyName.localeCompare(b.propertyName));

        // Group rows by month for section headers
        const monthSections: { month: string; rows: typeof monthRows; totalCost: number }[] = [];
        let currentMonth = "";
        for (const row of monthRows) {
          if (row.month !== currentMonth) {
            currentMonth = row.month;
            monthSections.push({ month: row.month, rows: [], totalCost: 0 });
          }
          const section = monthSections[monthSections.length - 1]!;
          section.rows.push(row);
          section.totalCost += row.costHuf;
        }

        const monthLabel = (m: string) => {
          const [y, mo] = m.split("-");
          const months = ["", "Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];
          return `${y}. ${months[Number(mo)]}`;
        };

        return monthRows.length === 0 ? (
          <div className="rounded-[24px] bg-card/90 p-8 text-center ring-1 ring-border/60">
            <p className="text-sm text-muted-foreground">Nincs havi adat.</p>
          </div>
        ) : (
          <>
          {/* Mobile cards — grouped by month */}
          <div className="space-y-6 md:hidden">
            {monthSections.map((section) => (
              <div key={section.month}>
                <div className="flex items-center justify-between px-1 pb-2">
                  <h3 className="text-sm font-semibold">{monthLabel(section.month)}</h3>
                  {section.totalCost > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">{formatCurrency(section.totalCost)}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {section.rows.map((row) => {
                    const colors = utilityColor(row.utilityType);
                    return (
                      <Link
                        key={`${row.propertyId}-${row.month}-${row.utilityType}`}
                        href={`/readings?property=${row.propertyId}`}
                        className="block rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50 transition hover:bg-secondary/40"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex rounded-xl p-2 ${colors.bg} ${colors.text}`}>
                              {utilityIcon(row.utilityType)}
                            </span>
                            <div>
                              <p className="font-semibold">{selectedPropertyIds.length !== 1 ? row.propertyName : (utilityLabels[row.utilityType] ?? row.utilityType)}</p>
                              {selectedPropertyIds.length !== 1 && <p className="text-xs text-muted-foreground">{utilityLabels[row.utilityType] ?? row.utilityType}</p>}
                              {row.isVirtual && <span className="inline-block mt-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 text-[9px] font-semibold">Számított</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-mono font-bold ${row.isVirtual ? "text-purple-700 dark:text-purple-300" : ""}`}>{row.consumption.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} {utilityUnits[row.utilityType] ?? ""}</p>
                            {row.costHuf > 0 && <p className={`text-xs ${row.isVirtual ? "text-purple-500" : "text-muted-foreground"}`}>{formatCurrency(row.costHuf)}</p>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table — grouped by month */}
          <div className="hidden overflow-auto rounded-[16px] border border-border/60 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {selectedPropertyIds.length !== 1 && <th className="px-4 py-3 font-semibold">Ingatlan</th>}
                  <th className="px-4 py-3 font-semibold">Közműtípus</th>
                  <th className="px-4 py-3 font-semibold">Fogyasztás</th>
                  <th className="px-4 py-3 font-semibold">Költség</th>
                  <th className="px-4 py-3 font-semibold">Forrás</th>
                </tr>
              </thead>
              <tbody>
                {monthSections.map((section) => (
                  <React.Fragment key={section.month}>
                    <tr>
                      <td colSpan={selectedPropertyIds.length === 1 ? 4 : 5} className="px-4 pb-1 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {monthLabel(section.month)}
                          </span>
                          {section.totalCost > 0 && (
                            <span className="text-xs font-medium text-muted-foreground">{formatCurrency(section.totalCost)}</span>
                          )}
                        </div>
                        <span className="mt-1 block h-px bg-border" />
                      </td>
                    </tr>
                    {section.rows.map((row) => {
                      const colors = utilityColor(row.utilityType);
                      return (
                        <tr
                          key={`${row.propertyId}-${row.month}-${row.utilityType}`}
                          className="border-b last:border-b-0 transition hover:bg-secondary/30"
                        >
                          {selectedPropertyIds.length !== 1 && <td className="px-4 py-3 text-muted-foreground">{row.propertyName}</td>}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex rounded-lg p-1.5 ${colors.bg} ${colors.text}`}>
                                {utilityIcon(row.utilityType)}
                              </span>
                              {utilityLabels[row.utilityType] ?? row.utilityType}
                            </div>
                          </td>
                          <td className={`px-4 py-3 font-mono font-medium ${row.isVirtual ? "text-purple-700 dark:text-purple-300" : ""}`}>
                            {row.consumption.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} {utilityUnits[row.utilityType] ?? ""}
                          </td>
                          <td className={`px-4 py-3 font-medium ${row.isVirtual ? "text-purple-700 dark:text-purple-300" : ""}`}>
                            {row.costHuf > 0 ? formatCurrency(row.costHuf) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {row.isVirtual ? (
                              <span className="rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs">Számított</span>
                            ) : (
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Okos mérő</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          </>
        );
      })()}

      {/* Yearly view */}
      {viewMode === "yearly" && (() => {
        type YearRow = { year: string; utilityType: string; consumption: number; costHuf: number; propertyName: string; propertyId: number; isVirtual: boolean };
        const yearMap = new Map<string, YearRow>();
        for (const r of filteredReadings) {
          const cons = r.virtualConsumption ?? r.consumption;
          const cost = r.virtualCostHuf ?? r.costHuf;
          if (cons == null || cons <= 0) continue;
          const dateStr = typeof r.readingDate === "string" ? r.readingDate : (r.readingDate as Date).toISOString();
          const year = dateStr.substring(0, 4);
          const key = `${r.propertyId}-${year}-${r.utilityType}`;
          const existing = yearMap.get(key);
          if (existing) {
            existing.consumption += cons;
            existing.costHuf += cost ?? 0;
          } else {
            yearMap.set(key, { year, utilityType: r.utilityType, consumption: cons, costHuf: cost ?? 0, propertyName: r.propertyName ?? "", propertyId: r.propertyId, isVirtual: r.virtualConsumption != null });
          }
        }
        const yearRows = [...yearMap.values()].sort((a, b) => b.year.localeCompare(a.year) || a.propertyName.localeCompare(b.propertyName));
        const yearSections: { year: string; rows: typeof yearRows; totalCost: number }[] = [];
        let curYear = "";
        for (const row of yearRows) {
          if (row.year !== curYear) { curYear = row.year; yearSections.push({ year: row.year, rows: [], totalCost: 0 }); }
          const sec = yearSections[yearSections.length - 1]!;
          sec.rows.push(row);
          sec.totalCost += row.costHuf;
        }

        return yearRows.length === 0 ? (
          <div className="rounded-[24px] bg-card/90 p-8 text-center ring-1 ring-border/60">
            <p className="text-sm text-muted-foreground">Nincs éves adat.</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-[16px] border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {selectedPropertyIds.length !== 1 && <th className="px-4 py-3 font-semibold">Ingatlan</th>}
                  <th className="px-4 py-3 font-semibold">Közműtípus</th>
                  <th className="px-4 py-3 font-semibold">Fogyasztás</th>
                  <th className="px-4 py-3 font-semibold">Költség</th>
                  <th className="px-4 py-3 font-semibold">Átlag/hó</th>
                </tr>
              </thead>
              <tbody>
                {yearSections.map((section) => (
                  <React.Fragment key={section.year}>
                    <tr>
                      <td colSpan={selectedPropertyIds.length === 1 ? 4 : 5} className="px-4 pb-1 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.year}</span>
                          {section.totalCost > 0 && <span className="text-xs font-medium text-muted-foreground">{formatCurrency(section.totalCost)}</span>}
                        </div>
                        <span className="mt-1 block h-px bg-border" />
                      </td>
                    </tr>
                    {section.rows.map((row) => {
                      const colors = utilityColor(row.utilityType);
                      return (
                        <tr key={`${row.propertyId}-${row.year}-${row.utilityType}`} className="border-b last:border-b-0 transition hover:bg-secondary/30">
                          {selectedPropertyIds.length !== 1 && <td className="px-4 py-3 text-muted-foreground">{row.propertyName}</td>}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex rounded-lg p-1.5 ${colors.bg} ${colors.text}`}>{utilityIcon(row.utilityType)}</span>
                              {utilityLabels[row.utilityType] ?? row.utilityType}
                            </div>
                          </td>
                          <td className={`px-4 py-3 font-mono font-medium ${row.isVirtual ? "text-purple-700 dark:text-purple-300" : ""}`}>
                            {row.consumption.toLocaleString("hu-HU", { maximumFractionDigits: 0 })} {utilityUnits[row.utilityType] ?? ""}
                          </td>
                          <td className={`px-4 py-3 font-medium ${row.isVirtual ? "text-purple-700 dark:text-purple-300" : ""}`}>
                            {row.costHuf > 0 ? formatCurrency(row.costHuf) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {Math.round(row.consumption / 12)} {utilityUnits[row.utilityType]}/hó
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Readings list */}
      {viewMode === "readings" && (filteredReadings.length === 0 ? (
        <div className="rounded-[24px] bg-card/90 p-8 text-center ring-1 ring-border/60">
          <p className="text-sm text-muted-foreground">
            Meg nincs leolvasas rogzitve.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...readingsByProperty.entries()].map(
            ([propertyId, { propertyName, readings }]) => (
              <section
                key={propertyId}
                className="rounded-[28px] bg-card/90 shadow-sm ring-1 ring-border/60"
              >
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
                  <Link
                    href={`/properties/${propertyId}`}
                    className="text-lg font-semibold tracking-tight hover:underline"
                  >
                    {propertyName}
                  </Link>
                  <Link
                    href={`/properties/${propertyId}/readings/new`}
                    className="rounded-full bg-background px-4 py-2 text-sm shadow-sm ring-1 ring-border/60 transition hover:bg-secondary/50"
                  >
                    + Leolvasás
                  </Link>
                </div>

                {/* Mobile card view */}
                <div className="space-y-3 p-4 sm:p-5 md:hidden">
                  {readings.map((r) => {
                    const colors = utilityColor(r.utilityType);
                    return (
                      <ClickableCard
                        key={r.id}
                        readingId={r.id}
                        className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`inline-flex rounded-xl p-2 ${colors.bg} ${colors.text}`}
                            >
                              {utilityIcon(r.utilityType)}
                            </div>
                            <div>
                              <p className="font-semibold">
                                {utilityLabels[r.utilityType] ?? r.utilityType}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {formatDate(r.readingDate)}
                                {(r.meterLocation || r.meterSerialNumber) && (
                                  <span className="ml-1 text-xs opacity-70">
                                    · {r.meterLocation ?? r.meterSerialNumber}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <p className="text-right font-mono text-sm font-semibold">
                            {r.value}
                          </p>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Fogyasztás</p>
                            <p className={`mt-1 font-medium ${r.virtualConsumption != null ? "text-purple-700 dark:text-purple-300" : ""}`}>
                              {r.virtualConsumption != null
                                ? `${r.virtualConsumption.toFixed(1)} ${utilityUnits[r.utilityType] ?? ""}`
                                : r.consumption != null
                                  ? `${r.consumption.toFixed(2)} ${utilityUnits[r.utilityType] ?? ""}`
                                  : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Költség</p>
                            <p className={`mt-1 font-medium ${r.virtualCostHuf != null ? "text-purple-700 dark:text-purple-300" : ""}`}>
                              {formatCurrency(r.virtualCostHuf ?? r.costHuf)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Forrás</p>
                            <p className="mt-1">
                              {r.virtualConsumption != null ? (
                                <span className="rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs">Számított</span>
                              ) : (
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{sourceLabel(r.source)}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </ClickableCard>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden overflow-x-auto px-5 pb-5 pt-2 sm:px-6 sm:pb-6 md:block">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-muted-foreground">
                        <th className="pb-3 font-medium">Közmű</th>
                        <th className="pb-3 font-medium">Mérő</th>
                        <th className="pb-3 font-medium">Dátum</th>
                        <th className="pb-3 font-medium">Állás</th>
                        <th className="pb-3 font-medium">Fogyasztás</th>
                        <th className="pb-3 font-medium">Költség</th>
                        <th className="pb-3 font-medium">Forrás</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map((r) => {
                        const colors = utilityColor(r.utilityType);
                        return (
                          <ClickableRow key={r.id} readingId={r.id}>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex rounded-lg p-1.5 ${colors.bg} ${colors.text}`}
                                >
                                  {utilityIcon(r.utilityType)}
                                </span>
                                <span>
                                  {utilityLabels[r.utilityType] ??
                                    r.utilityType}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-xs text-muted-foreground">
                              {r.meterInfoId ? (
                                <Link
                                  href={`/properties/${r.propertyId}/meters/${r.meterInfoId}/edit`}
                                  className="hover:text-primary hover:underline"
                                >
                                  {r.meterType === "virtual" && (
                                    <span className="mb-0.5 inline-block rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 text-[9px] font-semibold uppercase">Számított</span>
                                  )}
                                  {r.meterSerialNumber ? (
                                    <div>
                                      <p className="font-mono">{r.meterSerialNumber}</p>
                                      {r.meterLocation && <p className="text-[10px] opacity-70">{r.meterLocation}</p>}
                                    </div>
                                  ) : r.meterLocation ? (
                                    <p>{r.meterLocation}</p>
                                  ) : (
                                    <p className="italic">Szerkesztés</p>
                                  )}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3">{formatDate(r.readingDate)}</td>
                            <td className="py-3 font-mono">{r.value}</td>
                            <td className={`py-3 ${r.virtualConsumption != null ? "text-purple-700 dark:text-purple-300 font-medium" : ""}`}>
                              {r.virtualConsumption != null
                                ? `${r.virtualConsumption.toFixed(1)} ${utilityUnits[r.utilityType] ?? ""}`
                                : r.consumption != null
                                  ? `${r.consumption.toFixed(2)} ${utilityUnits[r.utilityType] ?? ""}`
                                  : "—"}
                            </td>
                            <td className={`py-3 ${r.virtualCostHuf != null ? "text-purple-700 dark:text-purple-300 font-medium" : ""}`}>
                              {formatCurrency(r.virtualCostHuf ?? r.costHuf)}
                            </td>
                            <td className="py-3">
                              {r.virtualConsumption != null ? (
                                <span className="rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs">Számított</span>
                              ) : (
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{sourceLabel(r.source)}</span>
                              )}
                            </td>
                          </ClickableRow>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
