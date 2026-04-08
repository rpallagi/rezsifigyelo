import Link from "next/link";
import type { ReactNode } from "react";

import { api } from "@/trpc/server";
import { formatCurrency, formatNumber, getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

function StatPanel({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-secondary text-foreground";

  return (
    <div className="rounded-[24px] bg-background/80 p-5 ring-1 ring-border/50">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>
        {label}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] bg-card/90 p-5 shadow-sm ring-1 ring-border/60 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
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
      return {
        ...property,
        annualRent,
        roi,
        breakEvenYears,
      };
    })
    .sort((a, b) => b.roi - a.roi);

  const totalPurchase = roiProperties.reduce((acc, property) => acc + (property.purchasePrice ?? 0), 0);
  const totalAnnualRent = roiProperties.reduce((acc, property) => acc + property.annualRent, 0);
  const avgROI = totalPurchase > 0 ? ((totalAnnualRent / totalPurchase) * 100).toFixed(1) : "—";
  const fastestBreakEven = roiProperties
    .filter((property) => property.breakEvenYears != null)
    .sort((a, b) => (a.breakEvenYears ?? Infinity) - (b.breakEvenYears ?? Infinity))[0];
  const bestYield = roiProperties[0];
  const monthlyRevenue = roiProperties.reduce((acc, property) => acc + (property.monthlyRent ?? 0), 0);

  const copy =
    locale === "hu"
      ? {
          subtitle:
            "A Stitch ROI Analytics admin screen alapján ez most befektetési cockpit: hozam, megtérülés és property rangsor egy nézetben.",
          annualCashflow: "Éves cashflow",
          fastestBreakEven: "Leggyorsabb megtérülés",
          bestYield: "Legjobb hozam",
          noData:
            "Adj meg vételárat és havi bérleti díjat az ingatlanokhoz a ROI számításhoz.",
          portfolioTable: "Portfólió rangsor",
          portfolioTableSubtitle:
            "A legerősebb hozamú ingatlanok kerülnek előre. Innen egyből megnyitható a property nézet.",
          investmentBasis: "Befektetési alap",
          annualRevenueLabel: "Éves bevétel",
          issuerLabel: "Kiállító profil",
          noProfile: "Nincs profil",
          years: "év",
        }
      : {
          subtitle:
            "Using the Stitch ROI Analytics admin screen as reference, this is now an investment cockpit: yield, break-even and property ranking in one view.",
          annualCashflow: "Annual cashflow",
          fastestBreakEven: "Fastest break-even",
          bestYield: "Best yield",
          noData:
            "Add purchase price and monthly rent to your properties to calculate ROI.",
          portfolioTable: "Portfolio ranking",
          portfolioTableSubtitle:
            "Properties are sorted by yield so the strongest performers surface first. You can open the property directly from here.",
          investmentBasis: "Investment basis",
          annualRevenueLabel: "Annual revenue",
          issuerLabel: "Issuer profile",
          noProfile: "No profile",
          years: "years",
        };

  return (
    <div className="space-y-8 pb-10">
      <section className="rounded-[32px] bg-gradient-to-br from-background via-card to-secondary/40 p-5 shadow-sm ring-1 ring-border/60 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.roiPage.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]">
            <StatPanel
              label={copy.bestYield}
              value={bestYield ? `${bestYield.roi.toFixed(1)}%` : "—"}
              detail={bestYield ? bestYield.name : copy.noData}
              tone="success"
            />
            <StatPanel
              label={copy.fastestBreakEven}
              value={fastestBreakEven?.breakEvenYears != null ? `${fastestBreakEven.breakEvenYears.toFixed(1)} ${copy.years}` : "—"}
              detail={fastestBreakEven ? fastestBreakEven.name : copy.noData}
              tone="warning"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatPanel
          label={m.roiPage.totalInvestment}
          value={formatCurrency(totalPurchase, locale)}
          detail={copy.investmentBasis}
        />
        <StatPanel
          label={m.roiPage.annualRevenue}
          value={formatCurrency(totalAnnualRent, locale)}
          detail={`${formatCurrency(monthlyRevenue, locale)} / hó`}
          tone="success"
        />
        <StatPanel label={m.roiPage.averageRoi} value={`${avgROI}%`} detail={copy.bestYield} tone="success" />
        <StatPanel
          label={m.roiPage.properties}
          value={formatNumber(roiProperties.length, locale)}
          detail={formatNumber(properties.length, locale)}
        />
        <StatPanel
          label={copy.fastestBreakEven}
          value={
            fastestBreakEven?.breakEvenYears != null
              ? `${fastestBreakEven.breakEvenYears.toFixed(1)} ${copy.years}`
              : "—"
          }
          detail={fastestBreakEven?.name ?? copy.noData}
          tone="warning"
        />
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
        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
          <SectionCard
            title={copy.portfolioTable}
            subtitle={copy.portfolioTableSubtitle}
            action={
              <Link
                href="/properties"
                className="rounded-full bg-background px-4 py-2 text-sm shadow-sm ring-1 ring-border/60 transition hover:bg-secondary/50"
              >
                {m.common.properties}
              </Link>
            }
          >
            <div className="space-y-3">
              {roiProperties.map((property, index) => (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  className="flex flex-col gap-4 rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50 transition hover:bg-secondary/40 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold tracking-tight">{property.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {property.address ?? m.common.noAddress}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-secondary px-2.5 py-1">
                          {copy.issuerLabel}: {property.landlordProfile?.displayName ?? copy.noProfile}
                        </span>
                        <span className="rounded-full bg-secondary px-2.5 py-1">
                          {copy.annualRevenueLabel}: {formatCurrency(property.annualRent, locale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {m.roiPage.purchasePrice}
                      </p>
                      <p className="mt-2 font-semibold">
                        {formatCurrency(property.purchasePrice ?? 0, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {m.roiPage.annualRevenue}
                      </p>
                      <p className="mt-2 font-semibold">{formatCurrency(property.annualRent, locale)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{m.roiPage.breakEven}</p>
                      <p className="mt-2 font-semibold">
                        {property.breakEvenYears != null
                          ? `${property.breakEvenYears.toFixed(1)} ${copy.years}`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="lg:min-w-[120px]">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">ROI</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{property.roi.toFixed(1)}%</p>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <div className="space-y-8">
            <SectionCard title={copy.bestYield}>
              {bestYield ? (
                <Link
                  href={`/properties/${bestYield.id}`}
                  className="block rounded-[24px] bg-background/80 p-5 ring-1 ring-border/50 transition hover:bg-secondary/40"
                >
                  <p className="text-xl font-semibold tracking-tight">{bestYield.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {bestYield.address ?? m.common.noAddress}
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <StatPanel
                      label="ROI"
                      value={`${bestYield.roi.toFixed(1)}%`}
                      detail={formatCurrency(bestYield.annualRent, locale)}
                      tone="success"
                    />
                    <StatPanel
                      label={m.roiPage.breakEven}
                      value={
                        bestYield.breakEvenYears != null
                          ? `${bestYield.breakEvenYears.toFixed(1)} ${copy.years}`
                          : "—"
                      }
                      detail={formatCurrency(bestYield.purchasePrice ?? 0, locale)}
                    />
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">{copy.noData}</p>
              )}
            </SectionCard>

            <SectionCard title={copy.fastestBreakEven}>
              {fastestBreakEven ? (
                <Link
                  href={`/properties/${fastestBreakEven.id}`}
                  className="block rounded-[24px] bg-background/80 p-5 ring-1 ring-border/50 transition hover:bg-secondary/40"
                >
                  <p className="text-xl font-semibold tracking-tight">{fastestBreakEven.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {fastestBreakEven.address ?? m.common.noAddress}
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <StatPanel
                      label={m.roiPage.breakEven}
                      value={`${fastestBreakEven.breakEvenYears?.toFixed(1) ?? "—"} ${copy.years}`}
                      detail={formatCurrency(fastestBreakEven.annualRent, locale)}
                      tone="warning"
                    />
                    <StatPanel
                      label={copy.bestYield}
                      value={`${fastestBreakEven.roi.toFixed(1)}%`}
                      detail={formatCurrency(fastestBreakEven.purchasePrice ?? 0, locale)}
                    />
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">{copy.noData}</p>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
