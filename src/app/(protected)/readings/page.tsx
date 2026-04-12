import { api } from "@/trpc/server";
import Link from "next/link";
import { Zap, Droplets, Flame, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Sparkline } from "@/components/shared/sparkline";
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
  value: number;
  consumption: number | null;
  costHuf: number | null;
  readingDate: string;
  source: string;
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
  searchParams: Promise<{ property?: string }>;
}) {
  const params = await searchParams;
  const activePropertyId = params.property ? Number(params.property) : null;

  const [allReadings, propertyList] = await Promise.all([
    api.reading.listAll(),
    api.property.list(),
  ]);

  const filteredReadings =
    activePropertyId != null
      ? allReadings.filter((r) => r.propertyId === activePropertyId)
      : allReadings;

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Leolvasások
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {filteredReadings.length} leolvasás
            {activePropertyId == null
              ? " az összes ingatlanból"
              : ` a kiválasztott ingatlanból`}
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

      {/* Utility trend cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {trendCards.map((card) => {
          const colors = utilityColor(card.type);
          return (
            <div
              key={card.type}
              className={`rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`inline-flex rounded-2xl p-2 ${colors.bg} ${colors.text}`}
                >
                  {utilityIcon(card.type)}
                </div>
                {card.changePercent != null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      card.changePercent < 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : card.changePercent > 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {card.changePercent < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : card.changePercent > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {Math.abs(card.changePercent).toFixed(1)}%
                  </span>
                )}
              </div>
              {card.sparkData.length >= 2 && (
                <div className="mt-3">
                  <Sparkline
                    data={card.sparkData}
                    color={card.type === "villany" ? "#eab308" : card.type === "gaz" ? "#ef4444" : "#3b82f6"}
                    height={36}
                  />
                </div>
              )}
              <p className="mt-3 text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-3xl font-semibold">
                {card.latestConsumption != null
                  ? `${card.latestConsumption.toFixed(2)} ${card.unit}`
                  : "—"}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Havi költség:{" "}
                <span className="font-medium text-foreground">
                  {card.monthlyCost > 0
                    ? formatCurrency(card.monthlyCost)
                    : "—"}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Property filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/readings"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activePropertyId == null
              ? "bg-primary text-primary-foreground"
              : "border border-border/70 bg-card text-foreground hover:bg-secondary"
          }`}
        >
          Összes
        </Link>
        {propertyList.map((property) => (
          <Link
            key={property.id}
            href={`/readings?property=${property.id}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activePropertyId === property.id
                ? "bg-primary text-primary-foreground"
                : "border border-border/70 bg-card text-foreground hover:bg-secondary"
            }`}
          >
            {property.name}
          </Link>
        ))}
      </div>

      {/* Readings list */}
      {filteredReadings.length === 0 ? (
        <div className="rounded-[24px] bg-card/90 p-8 text-center ring-1 ring-border/60">
          <p className="text-sm text-muted-foreground">
            Még nincs leolvasás rögzítve.
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
                            <p className="mt-1 font-medium">
                              {r.consumption != null
                                ? `${r.consumption.toFixed(2)} ${utilityUnits[r.utilityType] ?? ""}`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Költség</p>
                            <p className="mt-1 font-medium">
                              {formatCurrency(r.costHuf)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Forrás</p>
                            <p className="mt-1">
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                                {sourceLabel(r.source)}
                              </span>
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
                              {r.meterSerialNumber ? (
                                <div>
                                  <p className="font-mono">{r.meterSerialNumber}</p>
                                  {r.meterLocation && <p className="text-[10px] opacity-70">{r.meterLocation}</p>}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3">{formatDate(r.readingDate)}</td>
                            <td className="py-3 font-mono">{r.value}</td>
                            <td className="py-3">
                              {r.consumption != null
                                ? `${r.consumption.toFixed(2)} ${utilityUnits[r.utilityType] ?? ""}`
                                : "—"}
                            </td>
                            <td className="py-3">{formatCurrency(r.costHuf)}</td>
                            <td className="py-3">
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                                {sourceLabel(r.source)}
                              </span>
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
      )}
    </div>
  );
}
