import Link from "next/link";
import type { ReactNode } from "react";

import { api } from "@/trpc/server";
import { formatCurrency, formatNumber, getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

function MetricChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : tone === "danger"
          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          : "bg-white/10 text-white";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: "success" | "warning";
}) {
  return (
    <div className="rounded-[28px] bg-card/90 p-6 shadow-sm ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            accent === "success"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          }`}
        >
          <span className="text-xl">{accent === "success" ? "↗" : "⚡"}</span>
        </div>
        <p
          className={`text-xs font-bold uppercase tracking-[0.22em] ${
            accent === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-200"
          }`}
        >
          {accent === "success" ? "+ yield" : "focus"}
        </p>
      </div>
      <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-tight">{value}</p>
      <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] bg-card/90 p-6 shadow-sm ring-1 ring-border/60">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function propertyTypeLabel(propertyType: string) {
  switch (propertyType) {
    case "lakas":
      return "Lakás";
    case "uzlet":
      return "Iroda";
    case "telek":
      return "Telek";
    default:
      return "Villa";
  }
}

function placeholderCover(propertyType: string) {
  switch (propertyType) {
    case "lakas":
      return "linear-gradient(135deg, rgba(70,72,212,0.9), rgba(96,99,238,0.75)), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 42%)";
    case "uzlet":
      return "linear-gradient(135deg, rgba(0,108,73,0.92), rgba(108,248,187,0.68)), radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 40%)";
    case "telek":
      return "linear-gradient(135deg, rgba(131,81,0,0.9), rgba(255,185,95,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 40%)";
    default:
      return "linear-gradient(135deg, rgba(25,28,30,0.9), rgba(118,117,134,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 42%)";
  }
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function ROIPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const properties = await api.property.list();

  const roiProperties = properties
    .filter((property) => (property.purchasePrice ?? 0) > 0)
    .map((property) => {
      const purchasePrice = property.purchasePrice ?? 0;
      const annualRent = (property.monthlyRent ?? 0) * 12;
      const roi = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;
      const breakEvenYears = annualRent > 0 ? purchasePrice / annualRent : null;
      const maintenanceEstimate = Math.round(annualRent * 0.08);
      return {
        ...property,
        annualRent,
        roi,
        breakEvenYears,
        maintenanceEstimate,
      };
    })
    .sort((a, b) => b.roi - a.roi);

  const totalPurchase = roiProperties.reduce((acc, property) => acc + (property.purchasePrice ?? 0), 0);
  const totalAnnualRent = roiProperties.reduce((acc, property) => acc + property.annualRent, 0);
  const monthlyRevenue = roiProperties.reduce((acc, property) => acc + (property.monthlyRent ?? 0), 0);
  const avgROI = totalPurchase > 0 ? (totalAnnualRent / totalPurchase) * 100 : 0;
  const bestYield = roiProperties[0] ?? null;
  const lowestYield = [...roiProperties].sort((a, b) => a.roi - b.roi)[0] ?? null;
  const lowestMaintenance = [...roiProperties].sort(
    (a, b) => a.maintenanceEstimate - b.maintenanceEstimate,
  )[0] ?? null;
  const fastestBreakEven = [...roiProperties]
    .filter((property) => property.breakEvenYears != null)
    .sort((a, b) => (a.breakEvenYears ?? Infinity) - (b.breakEvenYears ?? Infinity))[0] ?? null;

  const chartSeries = roiProperties.slice(0, 6).map((property) => ({
    name: property.name,
    value: property.annualRent,
  }));
  const maxChartValue = Math.max(...chartSeries.map((item) => item.value), 1);

  const alerts = [
    lowestYield
      ? {
          tone: "danger" as const,
          title:
            locale === "hu" ? "Alacsony hozam figyelmeztetés" : "Low-yield warning",
          body:
            locale === "hu"
              ? `${lowestYield.name} hozama most ${formatPercent(lowestYield.roi)}.`
              : `${lowestYield.name} is currently at ${formatPercent(lowestYield.roi)} yield.`,
        }
      : null,
    lowestMaintenance
      ? {
          tone: "success" as const,
          title:
            locale === "hu" ? "Leghatékonyabb egység" : "Most efficient unit",
          body:
            locale === "hu"
              ? `${lowestMaintenance.name} fenntartási becslése ${formatCurrency(lowestMaintenance.maintenanceEstimate, locale)}.`
              : `${lowestMaintenance.name} has an estimated maintenance load of ${formatCurrency(lowestMaintenance.maintenanceEstimate, locale)}.`,
        }
      : null,
    fastestBreakEven
      ? {
          tone: "warning" as const,
          title:
            locale === "hu" ? "Leggyorsabb megtérülés" : "Fastest break-even",
          body:
            locale === "hu"
              ? `${fastestBreakEven.name} várhatóan ${fastestBreakEven.breakEvenYears?.toFixed(1)} év alatt térül meg.`
              : `${fastestBreakEven.name} is projected to break even in ${fastestBreakEven.breakEvenYears?.toFixed(1)} years.`,
        }
      : null,
  ].filter(Boolean) as Array<{ tone: "success" | "warning" | "danger"; title: string; body: string }>;

  const copy =
    locale === "hu"
      ? {
          subtitle:
            "Most már tényleg a Stitch ROI Analytics vizuális logikáját követi: nagy portfólió hero, insight badge-ek, képes property cardok és fókuszált pénzügyi riasztások.",
          updateLabel: "Legutóbbi frissítés",
          rangeLabel: "Utolsó 12 hónap",
          exportLabel: "Exportálás",
          highestYield: "Legmagasabb hozam",
          lowestMaintenance: "Legalacsonyabb fenntartás",
          portfolioOverview: "Portfólió áttekintés",
          annualYield: "Átlagos éves hozam",
          netCashflow: "Becsült nettó cash flow",
          occupancy: "Kiadási ráta",
          avgUtility: "Átlagos rezsi",
          yieldBreakdown: "Ingatlan-szintű megtérülés",
          cumulativeIncome: "Kumulatív bevétel",
          cumulativeIncomeSubtitle: "A legerősebb ingatlanok éves bevételi összehasonlítása",
          alertsTitle: "ROI figyelmeztetések",
          viewAllAlerts: "Minden riasztás megtekintése",
          netRent: "Nettó bérleti díj",
          maintenance: "Karbantartás",
          breakEvenStatus: "Megtérülési állapot",
          remaining: "hátralévő",
          noData:
            "Adj meg vételárat és havi bérleti díjat az ingatlanokhoz a ROI számításhoz.",
        }
      : {
          subtitle:
            "This now follows the Stitch ROI Analytics visual logic much more closely: large portfolio hero, insight badges, image-led property cards and focused financial alerts.",
          updateLabel: "Last updated",
          rangeLabel: "Last 12 months",
          exportLabel: "Export",
          highestYield: "Highest yield",
          lowestMaintenance: "Lowest maintenance",
          portfolioOverview: "Portfolio overview",
          annualYield: "Average annual yield",
          netCashflow: "Estimated net cash flow",
          occupancy: "Occupancy rate",
          avgUtility: "Average utility cost",
          yieldBreakdown: "Property yield breakdown",
          cumulativeIncome: "Cumulative income",
          cumulativeIncomeSubtitle: "Annual income comparison across the strongest properties",
          alertsTitle: "ROI alerts",
          viewAllAlerts: "View all alerts",
          netRent: "Net rent",
          maintenance: "Maintenance",
          breakEvenStatus: "Break-even status",
          remaining: "remaining",
          noData:
            "Add purchase price and monthly rent to your properties to calculate ROI.",
        };

  const occupancyRate =
    properties.length > 0
      ? ((properties.filter((property) => property.tenancies.length > 0).length / properties.length) * 100).toFixed(1)
      : "0.0";
  const avgUtilityCost =
    roiProperties.length > 0
      ? Math.round(
          roiProperties.reduce((acc, property) => acc + property.maintenanceEstimate, 0) /
            roiProperties.length,
        )
      : 0;

  return (
    <div className="space-y-8 pb-10">
      <section className="rounded-[32px] bg-gradient-to-br from-background via-card to-secondary/40 p-5 shadow-sm ring-1 ring-border/60 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">{m.roiPage.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {copy.subtitle}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {copy.updateLabel}: {new Date().toLocaleDateString(locale === "hu" ? "hu-HU" : "en-US")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl bg-background/80 px-4 py-3 text-sm shadow-sm ring-1 ring-border/50">
              {copy.rangeLabel}
            </div>
            <button
              type="button"
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              {copy.exportLabel}
            </button>
          </div>
        </div>
      </section>

      {roiProperties.length === 0 ? (
        <SectionCard title={m.roiPage.title} subtitle={copy.noData}>
          <div className="rounded-[24px] bg-background/80 p-8 text-center ring-1 ring-border/50">
            <p className="text-sm text-muted-foreground">{copy.noData}</p>
            <Link
              href="/properties"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {m.common.properties}
            </Link>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            {bestYield && (
              <div className="rounded-full bg-card/90 px-4 py-3 shadow-sm ring-1 ring-border/50">
                <span className="text-sm">
                  {copy.highestYield}: <span className="font-semibold">{bestYield.name}</span>
                </span>
              </div>
            )}
            {lowestMaintenance && (
              <div className="rounded-full bg-card/90 px-4 py-3 shadow-sm ring-1 ring-border/50">
                <span className="text-sm">
                  {copy.lowestMaintenance}: <span className="font-semibold">{lowestMaintenance.name}</span>
                </span>
              </div>
            )}
          </div>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8 rounded-[32px] bg-gradient-to-br from-primary to-primary-container p-8 text-white shadow-[0_20px_40px_rgba(70,72,212,0.18)]">
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/70">
                    {copy.portfolioOverview}
                  </p>
                  <div className="mt-6 flex flex-wrap items-end gap-6">
                    <div>
                      <p className="text-sm text-white/70">{m.roiPage.totalInvestment}</p>
                      <p className="mt-2 text-5xl font-semibold tracking-tight">
                        {formatCurrency(totalPurchase, locale)}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/20 bg-white/10 px-5 py-4 backdrop-blur">
                      <p className="text-sm text-white/70">{copy.annualYield}</p>
                      <p className="mt-2 text-3xl font-semibold text-emerald-200">
                        {formatPercent(avgROI)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm text-white/70">{copy.netCashflow}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {formatCurrency(monthlyRevenue, locale)}
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-primary transition hover:bg-white/90"
                  >
                    {m.common.dashboard}
                  </Link>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 flex flex-col gap-6">
              <StatCard
                label={copy.occupancy}
                value={`${occupancyRate}%`}
                detail={`${formatNumber(properties.filter((property) => property.tenancies.length > 0).length, locale)} / ${formatNumber(properties.length, locale)} ingatlan`}
                accent="success"
              />
              <StatCard
                label={copy.avgUtility}
                value={formatCurrency(avgUtilityCost, locale)}
                detail={copy.maintenance}
                accent="warning"
              />
            </div>
          </section>

          <SectionCard title={copy.yieldBreakdown}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {roiProperties.slice(0, 4).map((property) => {
                const breakEvenProgress = property.breakEvenYears
                  ? Math.max(8, Math.min(100, Math.round(100 / property.breakEvenYears)))
                  : 8;
                return (
                  <Link
                    key={property.id}
                    href={`/properties/${property.id}`}
                    className="group rounded-[28px] bg-background/80 p-4 shadow-sm ring-1 ring-border/50 transition hover:-translate-y-1 hover:bg-card"
                  >
                    <div className="relative mb-4 h-36 overflow-hidden rounded-[22px]">
                      {property.avatarUrl ? (
                        <img
                          src={property.avatarUrl}
                          alt={property.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{ background: placeholderCover(property.propertyType) }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                      <div className="absolute right-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold uppercase text-slate-900 shadow-sm">
                        {propertyTypeLabel(property.propertyType)}
                      </div>
                    </div>

                    <div>
                      <h3 className="truncate font-semibold tracking-tight">{property.name}</h3>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {property.address ?? m.common.noAddress}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-y border-border/50 py-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {copy.highestYield}
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
                          {formatPercent(property.roi)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {m.roiPage.breakEven}
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {property.breakEvenYears?.toFixed(1) ?? "—"} {locale === "hu" ? "év" : "yr"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{copy.netRent}</span>
                        <span className="font-medium">{formatCurrency(property.monthlyRent ?? 0, locale)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{copy.maintenance}</span>
                        <span className="font-medium text-rose-600 dark:text-rose-300">
                          {formatCurrency(property.maintenanceEstimate, locale)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        <span>{copy.breakEvenStatus}</span>
                        <span className="text-primary">
                          {property.breakEvenYears?.toFixed(1) ?? "—"} {copy.remaining}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${breakEvenProgress}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_0.42fr]">
            <SectionCard title={copy.cumulativeIncome} subtitle={copy.cumulativeIncomeSubtitle}>
              <div className="space-y-6">
                <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {chartSeries.slice(0, 3).map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          index === 0
                            ? "bg-primary"
                            : index === 1
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>

                <div className="relative h-80 rounded-[24px] bg-background/70 px-6 py-8 ring-1 ring-border/40">
                  <div className="absolute inset-x-6 top-8 bottom-16 flex flex-col justify-between">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="border-t border-border/40" />
                    ))}
                  </div>

                  <div className="relative z-10 flex h-full items-end justify-between gap-4 pt-6">
                    {chartSeries.map((item, index) => {
                      const height = Math.max(18, Math.round((item.value / maxChartValue) * 100));
                      const tone =
                        index === 0
                          ? "bg-primary"
                          : index === 1
                            ? "bg-emerald-500/85"
                            : index === 2
                              ? "bg-amber-500/85"
                              : "bg-primary/25";
                      return (
                        <div key={item.name} className="flex h-full flex-1 flex-col items-center justify-end gap-4">
                          <div className={`w-full max-w-[72px] rounded-t-xl ${tone}`} style={{ height: `${height}%` }} />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {item.name.slice(0, 8)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={copy.alertsTitle}>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.title}
                    className={`rounded-[22px] bg-background/80 p-4 ring-1 ${
                      alert.tone === "danger"
                        ? "ring-rose-300/60"
                        : alert.tone === "success"
                          ? "ring-emerald-300/60"
                          : "ring-primary/30"
                    }`}
                  >
                    <p
                      className={`text-xs font-bold uppercase tracking-[0.18em] ${
                        alert.tone === "danger"
                          ? "text-rose-700 dark:text-rose-300"
                          : alert.tone === "success"
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-primary"
                      }`}
                    >
                      {alert.title}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{alert.body}</p>
                  </div>
                ))}
                <button
                  type="button"
                  className="w-full rounded-[22px] bg-secondary px-5 py-4 text-sm font-semibold transition hover:bg-secondary/80"
                >
                  {copy.viewAllAlerts}
                </button>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
