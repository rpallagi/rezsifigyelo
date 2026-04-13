import Link from "next/link";
import { PropertyCoverImage } from "@/components/properties/property-cover-image";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Zap, Droplets, Flame, Waves } from "lucide-react";
import { ConsumptionChart } from "@/components/shared/consumption-chart";
import { Sparkline } from "@/components/shared/sparkline";
import { LivePowerBadge } from "@/components/shared/live-power-badge";
import { api } from "@/trpc/server";
import { CommonFeeCalendar } from "./common-fee-calendar";

const UTILITY_META: Record<string, { label: string; unit: string; color: string; icon: typeof Zap }> = {
  villany: { label: "Villany", unit: "kWh", color: "#eab308", icon: Zap },
  viz: { label: "Víz", unit: "m³", color: "#3b82f6", icon: Droplets },
  gaz: { label: "Gáz", unit: "m³", color: "#ef4444", icon: Flame },
  csatorna: { label: "Csatorna", unit: "m³", color: "#8b5cf6", icon: Waves },
};

function formatCurrency(value?: number | null) {
  return value != null ? `${value.toLocaleString("hu-HU")} Ft` : "—";
}

function utilityIcon(type: string) {
  switch (type) {
    case "villany":
      return <Zap className="h-4 w-4" />;
    case "viz":
    case "csatorna":
      return <Droplets className="h-4 w-4" />;
    case "gaz":
      return <Flame className="h-4 w-4" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
}

function utilityColor(type: string) {
  switch (type) {
    case "villany":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
    case "viz":
    case "csatorna":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
    case "gaz":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Víz",
  gaz: "Gáz",
  csatorna: "Csatorna",
  internet: "Internet",
  kozos_koltseg: "Közös költség",
  egyeb: "Egyéb",
};

function formatTenantName(
  tenant:
    | {
        firstName: string | null;
        lastName: string | null;
        email: string;
      }
    | null
    | undefined,
) {
  if (!tenant) return "Nincs";
  const fullName = [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim();
  return fullName || tenant.email;
}

function propertyTypeLabel(propertyType: string) {
  const builtIn: Record<string, string> = {
    lakas: "Lakás", uzlet: "Üzlet", telek: "Telek", egyeb: "Egyéb",
  };
  return builtIn[propertyType] ?? propertyType;
}

function statusTone(status: "success" | "warning" | "danger" | "neutral") {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "warning":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    case "danger":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    default:
      return "bg-secondary text-foreground";
  }
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
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

function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <div className="rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50">
      <div
        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(tone)}`}
      >
        {label}
      </div>
      <p className="mt-4 text-xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}

function ActionCard({
  href,
  label,
  detail,
  primary = false,
}: {
  href: string;
  label: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-[24px] bg-primary px-4 py-4 text-primary-foreground shadow-sm transition hover:bg-primary/90"
          : "rounded-[24px] bg-card/80 px-4 py-4 shadow-sm ring-1 ring-border/60 transition hover:bg-secondary/50"
      }
    >
      <p className="text-sm font-semibold tracking-tight">{label}</p>
      <p className={`mt-2 text-sm ${primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {detail}
      </p>
    </Link>
  );
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) {
    notFound();
  }

  const [property, allProperties] = await Promise.all([
    api.property.get({ id: numId }),
    api.property.list(),
  ]);
  if (!property) {
    notFound();
  }

  // Category Ft/m² comparison
  const rentPerSqm = property.monthlyRent && property.buildingArea
    ? property.monthlyRent / property.buildingArea
    : null;
  const categoryAvgRentPerSqm = (() => {
    if (!rentPerSqm) return null;
    const peers = allProperties.filter(
      (p) => p.id !== property.id && p.propertyType === property.propertyType && p.monthlyRent && p.buildingArea,
    );
    if (peers.length === 0) return null;
    const avg = peers.reduce((sum, p) => sum + p.monthlyRent! / p.buildingArea!, 0) / peers.length;
    return avg;
  })();
  const rentPerSqmDiffPct = rentPerSqm && categoryAvgRentPerSqm
    ? Math.round(((rentPerSqm - categoryAvgRentPerSqm) / categoryAvgRentPerSqm) * 100)
    : null;

  const activeTenancy = property.tenancies.find((tenancy) => tenancy.active);
  const pendingInvitation = property.tenantInvitations.find(
    (invitation) => invitation.status === "pending",
  );
  const latestReading = property.readings[0];
  const latestPayment = property.payments[0];
  const latestInvoice = property.invoices[0];
  const tenantLabel = activeTenancy
    ? formatTenantName(activeTenancy.tenant) !== "Nincs"
      ? formatTenantName(activeTenancy.tenant)
      : activeTenancy.tenantName ?? activeTenancy.tenantEmail ?? "Nincs aktív bérlő"
    : pendingInvitation
      ? pendingInvitation.tenantName ?? pendingInvitation.tenantEmail
      : "Nincs aktív bérlő";
  const buyerName =
    property.billingName ??
    (activeTenancy ? formatTenantName(activeTenancy.tenant) : null) ??
    activeTenancy?.tenantName ??
    property.contactName ??
    property.name;
  const buyerEmail =
    property.billingEmail ?? activeTenancy?.tenant?.email ?? activeTenancy?.tenantEmail ?? property.contactEmail ?? null;
  const unpaidTaxSeasons = property.propertyTaxes.reduce((count, tax) => {
    return count + (tax.springPaid ? 0 : 1) + (tax.autumnPaid ? 0 : 1);
  }, 0);
  const primaryActions = [
    {
      href: `/properties/${property.id}/readings/new`,
      label: "+ Mérőállás",
      detail: "Új leolvasás és fotó rögzítése.",
      primary: true,
    },
    {
      href: `/billing?propertyId=${property.id}`,
      label: "+ Számla",
      detail: "Számlázás a hozzárendelt kiállító profilból.",
      primary: true,
    },
    {
      href: `/properties/${property.id}/payments/new`,
      label: "+ Befizetés",
      detail: "Kézi befizetés vagy átutalás rögzítése.",
      primary: false,
    },
    activeTenancy
      ? {
          href: `/properties/${property.id}/move-out`,
          label: "Kiköltözés",
          detail: "Aktív tenancy lezárása és záró állapotok.",
          primary: false,
        }
      : {
          href: `/properties/${property.id}/move-in`,
          label: "+ Bérlő hozzáadása",
          detail: pendingInvitation
            ? "Függő meghívó mellett is folytatható a beköltözési folyamat."
            : "Bérlő felvétele és beköltözés indítása.",
          primary: true,
        },
  ];
  const secondaryActions = [
    { href: `/properties/${property.id}/meters/new`, label: "+ Mérőóra" },
    { href: `/properties/${property.id}/maintenance/new`, label: "+ Karbantartás" },
    { href: `/properties/${property.id}/documents/new`, label: "+ Dokumentum" },
    { href: `/properties/${property.id}/wifi/new`, label: "+ WiFi" },
    { href: `/properties/${property.id}/common-fees/new`, label: "+ Közös ktg." },
    { href: `/properties/${property.id}/tax/new`, label: "+ Adó" },
    { href: `/properties/${property.id}/chat`, label: "Chat" },
    { href: `/properties/${property.id}/marketing`, label: "Marketing" },
    { href: `/properties/${property.id}/edit`, label: "Szerkesztés" },
  ];

  return (
    <div className="space-y-8 pb-10">
      <section className="overflow-hidden rounded-[32px] shadow-sm ring-1 ring-border/60">
        {/* Property hero image / gradient */}
        <div className="relative h-[200px] w-full sm:h-[280px]">
          <PropertyCoverImage
            imageUrl={property.avatarUrl}
            title={property.name}
            className="absolute inset-0 h-full w-full object-cover"
            placeholderClassName="absolute inset-0 h-full w-full"
            placeholderBackground={
              property.propertyType === "lakas"
                ? "linear-gradient(135deg, rgba(70,72,212,0.92), rgba(96,99,238,0.75)), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 42%)"
                : property.propertyType === "uzlet"
                  ? "linear-gradient(135deg, rgba(0,108,73,0.92), rgba(108,248,187,0.68)), radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 40%)"
                  : property.propertyType === "telek"
                    ? "linear-gradient(135deg, rgba(131,81,0,0.9), rgba(255,185,95,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 40%)"
                    : "linear-gradient(135deg, rgba(25,28,30,0.9), rgba(118,117,134,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 42%)"
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
          <Link
            href={`/properties/${property.id}/edit`}
            className="group/photo absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-xs font-medium text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="hidden sm:inline">{property.avatarUrl ? "Fotó módosítása" : "Fotó feltöltése"}</span>
          </Link>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <Link
              href="/properties"
              className="inline-flex text-sm text-white/80 transition hover:text-white"
            >
              ← Vissza az ingatlanokhoz
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                {propertyTypeLabel(property.propertyType)}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm ${
                  activeTenancy
                    ? "bg-emerald-500/25 text-emerald-100"
                    : pendingInvitation
                      ? "bg-amber-500/25 text-amber-100"
                      : "bg-white/20 text-white"
                }`}
              >
                {activeTenancy
                  ? "Aktív bérlő"
                  : pendingInvitation
                    ? "Függő meghívó"
                    : "Szabad ingatlan"}
              </span>
              {property.landlordProfile && (
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  Kiállító: {property.landlordProfile.displayName}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {property.name}
            </h1>
            {property.address && (
              <p className="mt-2 max-w-2xl text-base text-white/75">
                {property.address}
              </p>
            )}
            {(property.buildingArea || property.landArea) && (
              <p className="mt-1.5 text-sm text-white/60">
                {[
                  property.buildingArea && `${property.buildingArea} m² épület`,
                  property.landArea && `${property.landArea} m² telek`,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-background via-card to-secondary/40 p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            {property.notes && (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {property.notes}
              </p>
            )}

            {pendingInvitation && (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-900 ring-1 ring-amber-300/60 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-700/50">
                Meghívó elküldve:{" "}
                <span className="font-medium">
                  {pendingInvitation.tenantName ?? pendingInvitation.tenantEmail}
                </span>
                {" · "}
                {pendingInvitation.tenantEmail}
              </div>
            )}
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-xl">
            <div className="rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Számlázási kontextus
              </p>
              <p className="mt-4 text-lg font-semibold tracking-tight">
                {property.landlordProfile?.displayName ?? "Nincs hozzárendelve"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {property.landlordProfile?.billingName ?? "Adj hozzá számlázó profilt az ingatlanhoz."}
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium">ÁFA:</span>{" "}
                  {property.billingVatCode ?? property.landlordProfile?.defaultVatCode ?? "TAM"}
                </p>
                <p>
                  <span className="font-medium">Számlázás:</span>{" "}
                  {property.billingMode === "arrears" ? "Utólag" : "Előre"}
                </p>
                <p>
                  <span className="font-medium">Határnap:</span>{" "}
                  {property.billingDueDay ?? property.landlordProfile?.defaultDueDays ?? "—"}
                </p>
                {property.landlordProfile?.taxNumber && (
                  <p>
                    <span className="font-medium">Kiállító adószám:</span>{" "}
                    {property.landlordProfile.taxNumber}
                  </p>
                )}
                {property.autoBilling && (
                  <p>
                    <span className="font-medium">Auto számlázás:</span>{" "}
                    hó {property.autoBillingDay}.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Bérlő
                </p>
                {activeTenancy && (
                  <Link
                    href={`/properties/${property.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    title="Bérlő adatainak szerkesztése"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Szerkesztés</span>
                  </Link>
                )}
              </div>
              <p className="mt-4 text-lg font-semibold tracking-tight">{tenantLabel}</p>
              {activeTenancy && (
                <div className="mt-4 space-y-2 text-sm">
                  {buyerEmail && (
                    <p>
                      <span className="font-medium">Email:</span> {buyerEmail}
                    </p>
                  )}
                  {activeTenancy.tenantPhone && (
                    <p>
                      <span className="font-medium">Telefon:</span> {activeTenancy.tenantPhone}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Adószám:</span>{" "}
                    {property.billingTaxNumber ?? "Nincs megadva"}
                  </p>
                  <p>
                    <span className="font-medium">Típus:</span>{" "}
                    {property.billingBuyerType === "company" ? "Cég" : "Magánszemély"}
                  </p>
                </div>
              )}
              {!activeTenancy && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Adj hozzá bérlőt a beköltözés menüpontban.
                </p>
              )}
            </div>
          </div>
        </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {primaryActions.map((action) => (
            <ActionCard
              key={action.href}
              href={action.href}
              label={action.label}
              detail={action.detail}
              primary={action.primary}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {secondaryActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-full bg-card/80 px-4 py-2 text-sm shadow-sm ring-1 ring-border/60 transition hover:bg-secondary/50"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      {property.handoverChecklists.filter((c) => c.checklistType === "move_in" && c.status === "pending").length > 0 && (
        <SectionCard
          title="Beköltözési teendők"
          subtitle="Ezeket érdemes elvégezni a beköltözés kapcsán."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {property.handoverChecklists
              .filter((c) => c.checklistType === "move_in")
              .map((item) => {
                const done = item.status === "completed";
                const stepConfig: Record<string, { label: string; href: string }> = {
                  meter_readings: { label: "Kezdő mérőállások", href: `/properties/${property.id}/readings/new` },
                  contract_upload: { label: "Szerződés feltöltése", href: `/properties/${property.id}/documents/new` },
                  handover_protocol: { label: "Átadás-átvételi jegyzőkönyv", href: `/properties/${property.id}/condition` },
                  key_handover: { label: "Kulcsátadás", href: `/properties/${property.id}/edit` },
                };
                const config = stepConfig[item.step] ?? { label: item.step, href: "#" };
                return (
                  <Link
                    key={item.id}
                    href={config.href}
                    className={`rounded-[22px] p-4 ring-1 transition hover:bg-secondary/50 ${
                      done
                        ? "bg-emerald-50/50 ring-emerald-200/60 dark:bg-emerald-950/20 dark:ring-emerald-800/40"
                        : "bg-background/80 ring-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${done ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {done ? "✓" : "○"}
                      </span>
                      <span className={`text-sm font-medium ${done ? "text-emerald-700 line-through dark:text-emerald-300" : ""}`}>
                        {config.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </SectionCard>
      )}

      {property.handoverChecklists.filter((c) => c.checklistType === "move_out" && c.status === "pending").length > 0 && (
        <SectionCard
          title="Kiköltözési teendők"
          subtitle="Ezeket érdemes elvégezni a kiköltözés kapcsán."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {property.handoverChecklists
              .filter((c) => c.checklistType === "move_out")
              .map((item) => {
                const done = item.status === "completed";
                const stepConfig: Record<string, { label: string; href: string }> = {
                  final_readings: { label: "Záró mérőállások", href: `/properties/${property.id}/readings/new` },
                  condition_assessment: { label: "Állapotfelvétel", href: `/properties/${property.id}/condition` },
                  deposit_settlement: { label: "Kaució elszámolás", href: `/properties/${property.id}/move-out` },
                  key_return: { label: "Kulcsvisszavétel", href: `/properties/${property.id}/edit` },
                };
                const config = stepConfig[item.step] ?? { label: item.step, href: "#" };
                return (
                  <Link
                    key={item.id}
                    href={config.href}
                    className={`rounded-[22px] p-4 ring-1 transition hover:bg-secondary/50 ${
                      done
                        ? "bg-emerald-50/50 ring-emerald-200/60 dark:bg-emerald-950/20 dark:ring-emerald-800/40"
                        : "bg-background/80 ring-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${done ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {done ? "✓" : "○"}
                      </span>
                      <span className={`text-sm font-medium ${done ? "text-emerald-700 line-through dark:text-emerald-300" : ""}`}>
                        {config.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </SectionCard>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Bérlő" value={tenantLabel} detail={buyerEmail ?? "Nincs számlázási email"} tone={activeTenancy ? "success" : pendingInvitation ? "warning" : "neutral"} />
        <StatCard label="Mérők" value={`${property.meterInfo.length} db`} detail={`${property.smartMeters.length} okosmérő kapcsolva`} />
        <StatCard label="Utolsó leolvasás" value={latestReading?.readingDate ?? "—"} detail={latestReading ? `${latestReading.utilityType} · ${latestReading.value}` : "Még nincs adat"} />
        <StatCard label="Utolsó számla" value={latestInvoice ? formatCurrency(latestInvoice.grossTotalHuf) : "—"} detail={latestInvoice ? latestInvoice.issueDate : "Még nincs kiállítva"} tone={latestInvoice ? "success" : "neutral"} />
        <StatCard
          label="Ft/m²"
          value={rentPerSqm ? `${Math.round(rentPerSqm).toLocaleString("hu-HU")} Ft/m²` : "—"}
          detail={
            rentPerSqmDiffPct !== null
              ? `${rentPerSqmDiffPct > 0 ? "▲" : rentPerSqmDiffPct < 0 ? "▼" : "="} ${Math.abs(rentPerSqmDiffPct)}% a kategória átlaghoz képest`
              : rentPerSqm
                ? "Nincs összehasonlítási adat"
                : "Adj meg m²-t és bérleti díjat"
          }
          tone={rentPerSqmDiffPct !== null ? (rentPerSqmDiffPct >= 0 ? "success" : "warning") : "neutral"}
        />
      </section>

      {/* Per-utility consumption cards */}
      {(() => {
        const utilityTypes = [...new Set(property.readings.map((r) => r.utilityType))];
        if (utilityTypes.length === 0 && property.smartMeters.length === 0) return null;

        for (const sm of property.smartMeters) {
          if (!utilityTypes.includes(sm.utilityType)) utilityTypes.push(sm.utilityType);
        }

        return (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {utilityTypes.map((ut) => {
              const meta = UTILITY_META[ut] ?? { label: ut, unit: "", color: "#6b7280", icon: Zap };
              const Icon = meta.icon;
              const allReadings = property.readings
                .filter((r) => r.utilityType === ut)
                .sort((a, b) => a.readingDate.localeCompare(b.readingDate));
              const withConsumption = allReadings.filter((r) => r.consumption != null && r.consumption > 0);
              const sparkData = withConsumption.map((r) => r.consumption!);
              const latest = withConsumption[withConsumption.length - 1];
              const prev = withConsumption.length >= 2 ? withConsumption[withConsumption.length - 2] : null;
              const smartDevice = property.smartMeters.find((sm) => sm.utilityType === ut);

              // Month label for latest reading
              const latestMonth = latest
                ? new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "short" }).format(new Date(latest.readingDate))
                : null;

              // MoM change (vs previous month)
              const momPct = latest && prev && prev.consumption
                ? Math.round(((latest.consumption! - prev.consumption) / prev.consumption) * 100)
                : null;

              // YoY change (vs same month last year)
              const latestDate = latest ? new Date(latest.readingDate) : null;
              const sameMonthLastYear = latestDate
                ? withConsumption.find((r) => {
                    const d = new Date(r.readingDate);
                    return d.getMonth() === latestDate.getMonth() && d.getFullYear() === latestDate.getFullYear() - 1;
                  })
                : null;
              const yoyPct = latest && sameMonthLastYear?.consumption
                ? Math.round(((latest.consumption! - sameMonthLastYear.consumption) / sameMonthLastYear.consumption) * 100)
                : null;

              const cardHref = smartDevice?.isActive
                ? `/readings?property=${property.id}`
                : `/properties/${property.id}/readings/new`;

              return (
                <Link
                  key={ut}
                  href={cardHref}
                  className="group rounded-[24px] bg-card/90 p-4 ring-1 ring-border/50 transition hover:ring-border hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg p-1.5" style={{ backgroundColor: `${meta.color}15` }}>
                        <Icon className="h-4 w-4" style={{ color: meta.color }} />
                      </div>
                      <span className="text-sm font-semibold">{meta.label}</span>
                    </div>
                    {latestMonth && (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {latestMonth}
                      </span>
                    )}
                  </div>

                  {sparkData.length >= 2 && (
                    <div className="mt-3">
                      <Sparkline data={sparkData} color={meta.color} height={44} />
                    </div>
                  )}

                  <div className="mt-2">
                    <p className="text-2xl font-bold tabular-nums">
                      {latest?.consumption != null
                        ? `${Math.round(latest.consumption).toLocaleString("hu-HU")} ${meta.unit}`
                        : allReadings.length > 0
                          ? `${Math.round(allReadings[allReadings.length - 1]!.value).toLocaleString("hu-HU")} ${meta.unit}`
                          : "—"}
                    </p>
                  </div>

                  {/* Comparison badges */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {momPct !== null && (
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        momPct > 5 ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                          : momPct < -5 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {momPct > 0 ? "▲" : momPct < 0 ? "▼" : "="}{Math.abs(momPct)}% előző hó
                      </span>
                    )}
                    {yoyPct !== null && (
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        yoyPct > 5 ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                          : yoyPct < -5 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {yoyPct > 0 ? "▲" : yoyPct < 0 ? "▼" : "="}{Math.abs(yoyPct)}% tavaly ilyenkor
                      </span>
                    )}
                  </div>

                  {/* Live power from Shelly Cloud (polls every 5s) */}
                  {smartDevice?.isActive && smartDevice.source === "shelly_cloud" && (
                    <LivePowerBadge
                      deviceId={smartDevice.shellyDeviceId ?? smartDevice.deviceId}
                      initialPower={smartDevice.lastRawValue}
                    />
                  )}
                </Link>
              );
            })}
          </section>
        );
      })()}

      {/* Meter cards — interactive */}
      {property.meterInfo.length > 0 && (
        <SectionCard title="Mérőórák" subtitle="Gyári számok, helyszínek és gyors ellenőrzés.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {property.meterInfo.map((meter) => {
              const smartDevice = property.smartMeters.find(
                (sm) => sm.meterInfoId === meter.id,
              ) ?? property.smartMeters.find(
                (sm) => sm.utilityType === meter.utilityType && !sm.meterInfoId,
              );
              // Use meter-specific readings if any reading has meterInfoId
              // Fallback to utility-wide if no meter-specific readings (for legacy data)
              const meterSpecificReadings = property.readings.filter((r) => r.meterInfoId === meter.id);
              const sameUtilityCount = property.meterInfo.filter(
                (m) => m.utilityType === meter.utilityType,
              ).length;
              const lastReading = meterSpecificReadings.length > 0
                ? meterSpecificReadings.sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0]
                : sameUtilityCount === 1
                  ? property.readings
                      .filter((r) => r.utilityType === meter.utilityType)
                      .sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0]
                  : null;

              // Find applicable tariff — prefer meter's own tariff group, fallback to property's
              const effectiveTariffGroup = meter.tariffGroup ?? property.tariffGroup;
              const applicableTariff = effectiveTariffGroup?.tariffs
                ?.filter((t) => t.utilityType === meter.utilityType)
                .sort((a, b) => String(b.validFrom).localeCompare(String(a.validFrom)))[0];
              const tariffSource = meter.tariffGroupId ? "mérő" : "ingatlan";

              const meterHref = smartDevice?.isActive
                ? `/readings?property=${property.id}`
                : `/properties/${property.id}/readings/new`;

              return (
                <div
                  key={meter.id}
                  className="group rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50 transition hover:ring-border hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold capitalize">{meter.utilityType}</p>
                      {meter.location && (
                        <p className="mt-1 text-sm text-muted-foreground">{meter.location}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {meter.meterType === "virtual" && (
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                          Számított
                        </span>
                      )}
                      {smartDevice && (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                          smartDevice.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-secondary text-muted-foreground"
                        }`}>
                          {smartDevice.isActive ? "Okos" : "Inaktív"}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-sm text-muted-foreground">
                    {meter.serialNumber ?? "Nincs gyári szám"}
                  </p>
                  {lastReading && (
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-bold tabular-nums">{lastReading.value.toLocaleString("hu-HU", { maximumFractionDigits: 1 })}</span>
                      <span className="text-xs text-muted-foreground">{lastReading.readingDate}</span>
                    </div>
                  )}
                  {smartDevice && smartDevice.isActive && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {smartDevice.lastRawValue != null && (
                        <p>Élő: <span className="font-medium text-foreground">{Math.round(smartDevice.lastRawValue).toLocaleString("hu-HU")} W</span></p>
                      )}
                      {smartDevice.lastSeenAt && (
                        <p>Utolsó jel: {new Date(smartDevice.lastSeenAt).toLocaleString("hu-HU")}</p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 rounded-lg bg-secondary/50 px-2 py-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Tarifa:</span>
                      <span className="font-medium tabular-nums">
                        {applicableTariff
                          ? `${applicableTariff.rateHuf} Ft/${applicableTariff.unit}`
                          : "Nincs"}
                      </span>
                    </div>
                    {effectiveTariffGroup && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {effectiveTariffGroup.name} · {tariffSource}
                      </div>
                    )}
                  </div>
                  {/* Virtual meter: show calculated consumption */}
                  {meter.meterType === "virtual" && meter.primaryMeterId && (() => {
                    // Find primary meter's latest reading
                    const primaryReadings = property.readings.filter(
                      (r) => r.meterInfoId === meter.primaryMeterId || (
                        !r.meterInfoId && property.meterInfo.find((m) => m.id === meter.primaryMeterId)?.utilityType === r.utilityType
                      ),
                    );
                    const primaryLatest = primaryReadings.sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];
                    const primaryConsumption = primaryLatest?.consumption ?? 0;

                    // Sum subtract meters' consumption
                    const subtractIds = Array.isArray(meter.subtractMeterIds) ? (meter.subtractMeterIds as number[]) : [];
                    let subtractTotal = 0;
                    for (const sid of subtractIds) {
                      const subReadings = property.readings.filter((r) => r.meterInfoId === sid);
                      const subLatest = subReadings.sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];
                      subtractTotal += subLatest?.consumption ?? 0;
                    }

                    const calculated = Math.max(0, primaryConsumption - subtractTotal);
                    const primaryMeterName = meter.primaryMeter?.property?.name ?? "Főmérő";

                    return (
                      <div className="mt-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 px-2 py-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-purple-600 dark:text-purple-400">Számított:</span>
                          <span className="font-bold tabular-nums text-purple-700 dark:text-purple-300">
                            {calculated.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} kWh
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          = {primaryMeterName} ({primaryConsumption.toLocaleString("hu-HU", { maximumFractionDigits: 1 })})
                          {subtractIds.map((sid) => {
                            const subName = property.meterInfo.find((m) => m.id === sid)?.location ?? "almérő";
                            const subReading = property.readings.filter((r) => r.meterInfoId === sid).sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];
                            return ` - ${subName} (${(subReading?.consumption ?? 0).toLocaleString("hu-HU", { maximumFractionDigits: 1 })})`;
                          })}
                        </p>
                      </div>
                    );
                  })()}
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={meterHref}
                      className="flex-1 text-center text-xs font-medium text-primary hover:underline"
                    >
                      {smartDevice?.isActive ? "Részletek →" : "Leolvasás →"}
                    </Link>
                    <Link
                      href={`/properties/${property.id}/meters/${meter.id}/edit`}
                      className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-secondary/80 hover:text-foreground"
                    >
                      Szerkesztés
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Fogyasztási trend"
        subtitle="Az utolsó rögzített leolvasásokból épített gyors áttekintés."
      >
        <ConsumptionChart
          readings={property.readings.map((reading) => ({
            readingDate: reading.readingDate,
            consumption: reading.consumption,
            utilityType: reading.utilityType,
          }))}
        />
      </SectionCard>

      <SectionCard
        title="Utolsó mérőállások"
        subtitle="Mobilon kártyás, nagyobb képernyőn táblás nézet."
        action={
          <Link
            href={`/properties/${property.id}/readings/new`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            + Új leolvasás
          </Link>
        }
      >
        {property.readings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Még nincs mérőállás rögzítve.</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {property.readings.map((reading) => (
                <div key={reading.id} className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-xl p-2 ${utilityColor(reading.utilityType)}`}>
                        {utilityIcon(reading.utilityType)}
                      </span>
                      <div>
                        <p className="font-semibold">{utilityLabels[reading.utilityType] ?? reading.utilityType}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{reading.readingDate}</p>
                      </div>
                    </div>
                    <p className="text-right font-mono text-sm font-semibold">{reading.value}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Fogyasztás</p>
                      <p className="mt-1 font-medium">{reading.consumption ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Költség</p>
                      <p className="mt-1 font-medium">{formatCurrency(reading.costHuf)}</p>
                    </div>
                  </div>
                  {reading.photoUrl && (
                    <a
                      href={reading.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
                    >
                      Fotó megnyitása
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Dátum</th>
                    <th className="pb-3 font-medium">Közmű</th>
                    <th className="pb-3 font-medium">Állás</th>
                    <th className="pb-3 font-medium">Fogyasztás</th>
                    <th className="pb-3 font-medium">Költség</th>
                    <th className="pb-3 font-medium">Fotó</th>
                  </tr>
                </thead>
                <tbody>
                  {property.readings.map((reading) => (
                    <tr key={reading.id} className="border-b border-border/50">
                      <td className="py-3">{reading.readingDate}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className={`inline-flex rounded-lg p-1.5 ${utilityColor(reading.utilityType)}`}>
                            {utilityIcon(reading.utilityType)}
                          </span>
                          {utilityLabels[reading.utilityType] ?? reading.utilityType}
                        </span>
                      </td>
                      <td className="py-3">{reading.value}</td>
                      <td className="py-3">{reading.consumption ?? "—"}</td>
                      <td className="py-3">{formatCurrency(reading.costHuf)}</td>
                      <td className="py-3">
                        {reading.photoUrl ? (
                          <a
                            href={reading.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            Fotó
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Befizetések"
        subtitle="A legutóbbi pénzmozgások gyors áttekintése."
        action={
          <Link
            href={`/properties/${property.id}/payments/new`}
            className="rounded-full bg-background px-4 py-2 text-sm shadow-sm ring-1 ring-border/60 transition hover:bg-secondary/50"
          >
            Új befizetés
          </Link>
        }
      >
        {property.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Még nincs befizetés rögzítve.</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {property.payments.map((payment) => (
                <div key={payment.id} className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{formatCurrency(payment.amountHuf)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{payment.paymentDate}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {payment.paymentMethod ?? "—"}
                    </span>
                  </div>
                  {payment.notes && (
                    <p className="mt-4 text-sm text-muted-foreground">{payment.notes}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Dátum</th>
                    <th className="pb-3 font-medium">Összeg</th>
                    <th className="pb-3 font-medium">Mód</th>
                    <th className="pb-3 font-medium">Megjegyzés</th>
                  </tr>
                </thead>
                <tbody>
                  {property.payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border/50">
                      <td className="py-3">{payment.paymentDate}</td>
                      <td className="py-3">{formatCurrency(payment.amountHuf)}</td>
                      <td className="py-3">{payment.paymentMethod ?? "—"}</td>
                      <td className="py-3 text-muted-foreground">{payment.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {latestPayment && (
          <p className="mt-4 text-xs text-muted-foreground">
            Utolsó befizetés: {latestPayment.paymentDate} · {formatCurrency(latestPayment.amountHuf)}
          </p>
        )}
      </SectionCard>

      {property.invoices.length > 0 && (
        <SectionCard
          title="Számlák"
          subtitle="A propertyhez tartozó legfrissebb számlák és PDF-ek."
          action={
            <Link
              href={`/billing?propertyId=${property.id}`}
              className="rounded-full bg-background px-4 py-2 text-sm shadow-sm ring-1 ring-border/60 transition hover:bg-secondary/50"
            >
              Számlázás megnyitása
            </Link>
          }
        >
          <div className="space-y-3">
            {property.invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{invoice.invoiceNumber ?? `#${invoice.id}`}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{invoice.issueDate}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{invoice.buyerName}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold">{formatCurrency(invoice.grossTotalHuf)}</p>
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                      >
                        PDF megnyitása
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {property.maintenanceLogs.length > 0 && (
        <SectionCard title="Karbantartás" subtitle="Friss hibák, beavatkozások és költségek.">
          <div className="space-y-3">
            {property.maintenanceLogs.map((log) => (
              <div key={log.id} className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{log.description}</p>
                    {log.category && (
                      <span className="mt-2 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {log.category}
                      </span>
                    )}
                    {log.performedBy && (
                      <p className="mt-3 text-xs text-muted-foreground">{log.performedBy}</p>
                    )}
                  </div>
                  <div className="text-left text-sm sm:text-right">
                    <p className="text-muted-foreground">{log.performedDate ?? "Függőben"}</p>
                    {log.costHuf != null && log.costHuf > 0 && (
                      <p className="mt-1 font-semibold">{formatCurrency(log.costHuf)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        {property.documents.length > 0 && (
          <SectionCard title="Dokumentumok" subtitle="Szerződések, képek és letölthető mellékletek.">
            <div className="space-y-2">
              {property.documents.map((document) => (
                <a
                  key={document.id}
                  href={document.storedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-[20px] bg-background/80 p-4 ring-1 ring-border/50 transition hover:bg-secondary/40"
                >
                  <div>
                    <p className="text-sm font-medium">{document.filename}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {document.category.replace("_", " ")}
                      {document.fileSize && ` · ${(document.fileSize / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(document.uploadedAt).toLocaleDateString("hu-HU")}
                  </span>
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {property.wifiNetworks.length > 0 && (
          <SectionCard title="WiFi hálózatok" subtitle="A propertyhez tartozó hozzáférések és helyek.">
            <div className="grid gap-3">
              {property.wifiNetworks.map((wifi) => (
                <div key={wifi.id} className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50">
                  <p className="font-semibold">{wifi.ssid}</p>
                  <p className="mt-2 font-mono text-sm text-muted-foreground">{wifi.password ?? "—"}</p>
                  {wifi.location && <p className="mt-2 text-xs text-muted-foreground">{wifi.location}</p>}
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {(property.commonFees.length > 0 || property.propertyTaxes.length > 0) && (
        <div className="grid gap-8 xl:grid-cols-2">
          {property.commonFees.length > 0 && (
            <SectionCard title="Közös költség" subtitle="Fix vagy rendszeres társasházi tételek.">
              <div className="space-y-3">
                {property.commonFees.map((fee) => (
                  <div key={fee.id} className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          {formatCurrency(fee.monthlyAmount)} / {fee.frequency === "monthly" ? "hó" : "negyedév"}
                        </p>
                        {fee.recipient && (
                          <p className="mt-1 text-sm text-muted-foreground">{fee.recipient}</p>
                        )}
                      </div>
                      {fee.bankAccount && (
                        <p className="font-mono text-xs text-muted-foreground">{fee.bankAccount}</p>
                      )}
                    </div>
                    <CommonFeeCalendar
                      commonFeeId={fee.id}
                      monthlyAmount={fee.monthlyAmount}
                      paymentsTracking={fee.paymentsTracking}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {property.propertyTaxes.length > 0 && (
            <SectionCard title="Ingatlanadó" subtitle="Szezonális státuszok és éves kötelezettségek.">
              <div className="space-y-3">
                {property.propertyTaxes.map((tax) => (
                  <div key={tax.id} className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          {tax.year} · {formatCurrency(tax.annualAmount)} / év
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tax.springPaid ? statusTone("success") : statusTone("danger")}`}>
                          Tavasz {tax.springPaid ? "✓" : "✗"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tax.autumnPaid ? statusTone("success") : statusTone("danger")}`}>
                          Ősz {tax.autumnPaid ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {property.tenantHistory.length > 0 && (
        <SectionCard title="Korábbi bérlők" subtitle="Archivált bérleti viszonyok.">
          <div className="grid gap-3 md:grid-cols-2">
            {property.tenantHistory.map((history) => (
              <div key={history.id} className="rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50">
                <p className="font-semibold">{history.tenantName ?? "Ismeretlen bérlő"}</p>
                {history.tenantEmail && (
                  <p className="mt-1 text-sm text-muted-foreground">{history.tenantEmail}</p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Beköltözés</p>
                    <p className="mt-1 font-medium">{history.moveInDate ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kiköltözés</p>
                    <p className="mt-1 font-medium">{history.moveOutDate ?? "—"}</p>
                  </div>
                </div>
                {(history.depositAmount != null || history.depositReturned != null) && (
                  <div className="mt-3 space-y-1 border-t border-border/50 pt-3 text-sm">
                    {history.depositAmount != null && (
                      <p>
                        <span className="text-muted-foreground">Kaució:</span>{" "}
                        <span className="font-medium">{formatCurrency(history.depositAmount)}</span>
                      </p>
                    )}
                    {history.depositReturned != null && (
                      <p>
                        <span className="text-muted-foreground">Visszaadva:</span>{" "}
                        <span className="font-medium">{formatCurrency(history.depositReturned)}</span>
                      </p>
                    )}
                    {history.depositDeductions != null && history.depositDeductions > 0 && (
                      <p>
                        <span className="text-muted-foreground">Levonás:</span>{" "}
                        <span className="font-medium">{formatCurrency(history.depositDeductions)}</span>
                      </p>
                    )}
                    {history.depositNotes && (
                      <p className="text-xs text-muted-foreground">{history.depositNotes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
