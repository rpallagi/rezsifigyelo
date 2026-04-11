import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import {
  formatCurrency,
  formatNumber,
  getMessages,
  type Locale,
  type Messages,
} from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { api } from "@/trpc/server";

function StatusChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-secondary text-foreground";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function HeroStat({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-[24px] bg-background/80 p-5 ring-1 ring-border/50 transition hover:bg-card">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function getDashboardCopy(locale: Locale, pendingAssignments = 0, vacantProperties = 0) {
  return locale === "hu"
    ? {
        title: "Portfólió áttekintés",
        subtitle:
          "Az ingatlanportfólió egészsége, bérlők, számlázás és azonnali teendők egy helyen.",
        yield: "Portfólió hozam",
        annualCashflow: "Éves cashflow",
        profiles: "Kiállító profilok",
        topPerformer: "Legjobb hozam",
        topPerformerEmpty: "Adj meg vételárat és bérleti díjat legalább egy ingatlanhoz.",
        attention: "Figyelmet kér",
        attentionEmpty: "Nincs kritikus hiányosság. A portfólió jelenleg rendezett.",
        recentLabel: "Portfólió nézet",
        vacantDetail: `${vacantProperties} üres ingatlan · ${pendingAssignments} profil nélkül`,
        assignedProfile: "Kiállító",
        noProfile: "Nincs profil",
        activeTenant: "Aktív bérlő",
        vacant: "Jelenleg üres",
        monthly: "havi bevétel",
        roi: "ROI",
        breakEven: "Megtérülés",
        years: "év",
        assignProfileHint: "Adj hozzá kiállító profilt az ingatlanhoz a számlázáshoz.",
        vacantHint: "Ehhez az ingatlanhoz még nincs aktív bérlő.",
        loading: "A portfólió blokkjai betöltés alatt vannak.",
      }
    : {
        title: "Portfolio overview",
        subtitle:
          "Based on the Stitch ROI Analytics direction, this dashboard now prioritizes portfolio health, billing context and immediate actions.",
        yield: "Portfolio yield",
        annualCashflow: "Annual cashflow",
        profiles: "Issuer profiles",
        topPerformer: "Top performer",
        topPerformerEmpty: "Add purchase price and rent to at least one property.",
        attention: "Needs attention",
        attentionEmpty: "No critical gaps right now. The portfolio is in good shape.",
        recentLabel: "Portfolio view",
        vacantDetail: `${vacantProperties} vacant properties · ${pendingAssignments} without profile`,
        assignedProfile: "Issuer",
        noProfile: "No profile",
        activeTenant: "Active tenant",
        vacant: "Currently vacant",
        monthly: "monthly revenue",
        roi: "ROI",
        breakEven: "Break-even",
        years: "years",
        assignProfileHint: "Assign an issuer profile before billing from this property.",
        vacantHint: "This property does not have an active tenant yet.",
        loading: "Portfolio modules are loading.",
      };
}

function DashboardSkeleton({
  locale,
  m,
}: {
  locale: Locale;
  m: Messages;
}) {
  const copy = getDashboardCopy(locale);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          m.dashboardPage.totalProperties,
          m.dashboardPage.activeTenants,
          m.dashboardPage.totalMeters,
          m.dashboardPage.monthlyRevenue,
          copy.profiles,
        ].map((label) => (
          <div
            key={label}
            className="rounded-[24px] bg-background/80 p-5 ring-1 ring-border/50"
          >
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <div className="mt-4 h-10 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] bg-card/90 p-5 shadow-sm ring-1 ring-border/60 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{m.dashboardPage.recentProperties}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.loading}</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50"
              >
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="h-12 animate-pulse rounded bg-muted" />
                  <div className="h-12 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <div className="rounded-[28px] bg-card/90 p-5 shadow-sm ring-1 ring-border/60">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="rounded-[28px] bg-card/90 p-5 shadow-sm ring-1 ring-border/60">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-24 animate-pulse rounded bg-muted" />
          </div>
        </section>
      </div>
    </>
  );
}

async function DashboardContent({
  locale,
  m,
}: {
  locale: Locale;
  m: Messages;
}) {
  const [user, properties, landlordProfileCount] = await Promise.all([
    api.user.me(),
    api.property.list(),
    api.landlordProfile.count(),
  ]);

  const totalProperties = properties.length;
  const activeTenants = properties.reduce(
    (acc, property) => acc + property.tenancies.filter((tenancy) => tenancy.active).length,
    0,
  );
  const totalMeters = properties.reduce((acc, property) => acc + property.meterInfo.length, 0);
  const monthlyRevenue = properties.reduce((acc, property) => acc + (property.monthlyRent ?? 0), 0);
  const propertiesWithPurchase = properties.filter(
    (property) => (property.purchasePrice ?? 0) > 0 && (property.monthlyRent ?? 0) > 0,
  );
  const portfolioInvestment = properties.reduce(
    (acc, property) => acc + (property.purchasePrice ?? 0),
    0,
  );
  const annualRevenue = monthlyRevenue * 12;
  const portfolioYield =
    portfolioInvestment > 0 ? ((annualRevenue / portfolioInvestment) * 100).toFixed(1) : "—";
  const pendingAssignments = properties.filter((property) => !property.landlordProfile).length;
  const vacantProperties = properties.filter((property) => property.tenancies.length === 0).length;

  const rankedProperties = propertiesWithPurchase
    .map((property) => {
      const annualRent = (property.monthlyRent ?? 0) * 12;
      const purchasePrice = property.purchasePrice ?? 0;
      const roi = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;
      return {
        ...property,
        annualRent,
        roi,
        breakEvenYears: annualRent > 0 ? purchasePrice / annualRent : null,
      };
    })
    .sort((a, b) => b.roi - a.roi);

  const topPerformer = rankedProperties[0] ?? null;
  const attentionProperty =
    properties.find((property) => !property.landlordProfile) ??
    properties.find((property) => property.tenancies.length === 0) ??
    null;

  const copy = getDashboardCopy(locale, pendingAssignments, vacantProperties);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <HeroStat
          label={m.dashboardPage.totalProperties}
          value={formatNumber(totalProperties, locale)}
          detail={copy.vacantDetail}
          href="/properties"
        />
        <HeroStat
          label={m.dashboardPage.activeTenants}
          value={formatNumber(activeTenants, locale)}
          detail={locale === "hu" ? `${vacantProperties} szabad ingatlan` : `${vacantProperties} vacant`}
          href="/tenants"
        />
        <HeroStat
          label={m.dashboardPage.totalMeters}
          value={formatNumber(totalMeters, locale)}
          detail={locale === "hu" ? "Összes leolvasás →" : "All readings →"}
          href="/readings"
        />
        <HeroStat
          label={m.dashboardPage.monthlyRevenue}
          value={formatCurrency(monthlyRevenue, locale)}
          detail={locale === "hu" ? `Éves: ${formatCurrency(annualRevenue, locale)}` : `Annual: ${formatCurrency(annualRevenue, locale)}`}
          href="/billing"
        />
        <HeroStat
          label={copy.profiles}
          value={formatNumber(landlordProfileCount, locale)}
          detail={locale === "hu" ? `${properties.length - pendingAssignments} ingatlan hozzárendelve` : `${properties.length - pendingAssignments} properties assigned`}
          href="/settings/landlord-profiles"
        />
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] bg-card/90 p-5 shadow-sm ring-1 ring-border/60 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="success">{copy.recentLabel}</StatusChip>
                <StatusChip tone={pendingAssignments > 0 || vacantProperties > 0 ? "warning" : "neutral"}>
                  {copy.vacantDetail}
                </StatusChip>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight">
                {m.dashboardPage.greeting}, {user.firstName ?? user.email}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.dashboardPage.welcome}</p>
            </div>
            <Link
              href="/properties"
              className="rounded-full bg-background px-4 py-2 text-sm shadow-sm ring-1 ring-border/60 transition hover:bg-secondary/50"
            >
              {m.common.properties}
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <HeroStat
              label={copy.yield}
              value={`${portfolioYield}%`}
              detail={formatCurrency(portfolioInvestment, locale)}
              href="/roi"
            />
            <HeroStat
              label={copy.annualCashflow}
              value={formatCurrency(annualRevenue, locale)}
              detail={`${formatCurrency(monthlyRevenue, locale)} ${copy.monthly}`}
              href="/roi"
            />
          </div>

          {properties.length === 0 ? (
            <div className="mt-8 rounded-[24px] bg-background/80 p-8 text-center ring-1 ring-border/50">
              <p className="text-muted-foreground">{m.dashboardPage.empty}</p>
              <Link
                href="/properties/new"
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {m.dashboardPage.createProperty}
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {properties.slice(0, 6).map((property) => (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  className="rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50 transition hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold tracking-tight">{property.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {property.address ?? m.common.noAddress}
                      </p>
                    </div>
                    <StatusChip tone={property.landlordProfile ? "success" : "warning"}>
                      {property.landlordProfile ? copy.assignedProfile : copy.noProfile}
                    </StatusChip>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">{m.dashboardPage.totalMeters}</p>
                      <p className="mt-1 font-medium">
                        {formatNumber(property.meterInfo.length, locale)} {m.common.metersSuffix}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{m.dashboardPage.monthlyRevenue}</p>
                      <p className="mt-1 font-medium">
                        {property.monthlyRent
                          ? `${Math.round(property.monthlyRent).toLocaleString(locale === "hu" ? "hu-HU" : "en-US")} ${property.rentCurrency === "EUR" ? "€" : "Ft"}`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary px-2.5 py-1">
                      {property.tenancies[0]
                        ? `${copy.activeTenant}: ${property.tenancies[0].tenant?.firstName ?? property.tenancies[0].tenantName ?? property.tenancies[0].tenant?.email ?? property.tenancies[0].tenantEmail ?? ""}`
                        : copy.vacant}
                    </span>
                    {property.landlordProfile && (
                      <span className="rounded-full bg-secondary px-2.5 py-1">
                        {property.landlordProfile.displayName}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4">
          <section className="rounded-[28px] bg-card/90 p-5 shadow-sm ring-1 ring-border/60">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {copy.topPerformer}
            </p>
            {topPerformer ? (
              <div className="mt-4 space-y-3">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{topPerformer.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{topPerformer.address ?? m.common.noAddress}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <HeroStat
                    label={copy.roi}
                    value={`${topPerformer.roi.toFixed(1)}%`}
                    detail={formatCurrency(topPerformer.annualRent, locale)}
                    href={`/properties/${topPerformer.id}`}
                  />
                  <HeroStat
                    label={copy.breakEven}
                    value={
                      topPerformer.breakEvenYears
                        ? `${topPerformer.breakEvenYears.toFixed(1)} ${copy.years}`
                        : "—"
                    }
                    detail={topPerformer.landlordProfile?.displayName ?? copy.noProfile}
                    href="/roi"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">{copy.topPerformerEmpty}</p>
            )}
          </section>

          <section className="rounded-[28px] bg-card/90 p-5 shadow-sm ring-1 ring-border/60">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {copy.attention}
            </p>
            {attentionProperty ? (
              <div className="mt-4 space-y-3">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{attentionProperty.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {attentionProperty.landlordProfile ? copy.vacantHint : copy.assignProfileHint}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusChip tone={attentionProperty.landlordProfile ? "warning" : "neutral"}>
                    {attentionProperty.landlordProfile
                      ? `${copy.vacantDetail}`
                      : copy.noProfile}
                  </StatusChip>
                  <Link
                    href={`/properties/${attentionProperty.id}`}
                    className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {m.common.property}
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">{copy.attentionEmpty}</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default async function DashboardPage() {
  const locale = await getCurrentLocale();
  const copy = getDashboardCopy(locale);
  const m = getMessages(locale);

  return (
    <div className="space-y-8 pb-10">
      <section className="rounded-[32px] bg-gradient-to-br from-background via-card to-secondary/40 p-5 shadow-sm ring-1 ring-border/60 sm:p-7">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="success">{copy.recentLabel}</StatusChip>
          </div>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
      </section>

      <Suspense fallback={<DashboardSkeleton locale={locale} m={m} />}>
        <DashboardContent locale={locale} m={m} />
      </Suspense>
    </div>
  );
}
