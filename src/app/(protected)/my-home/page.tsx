import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  Droplets,
  Waves,
  ChevronRight,
  Calendar,
  ClipboardEdit,
  MessageSquare,
  History,
  Building2,
  Flame,
} from "lucide-react";
import { TenantHomeChart } from "./tenant-home-chart";
import { SignOutButton } from "./sign-out-button";

function formatHuf(value: number): string {
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("hu-HU", { maximumFractionDigits: 2 });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("hu-HU", {
    month: "short",
    day: "numeric",
  });
}

type ReadingRow = {
  id: number;
  utilityType: string;
  value: number;
  consumption: number | null;
  costHuf: number | null;
  readingDate: string;
};

export default async function TenantHomePage() {
  const user = await api.user.me();

  if (user.role !== "tenant") {
    redirect("/dashboard");
  }

  const activeTenancy = await api.tenancy.myActive();

  if (!activeTenancy) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Üdv, {user.firstName ?? user.email}</h1>
          <SignOutButton />
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Még nincs ingatlanod</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ahhoz hogy lásd a fogyasztásodat és üzeneteket válts a bérbeadóddal,
            kérd meg hogy küldjön meghívót emailben.
          </p>
        </div>
      </div>
    );
  }

  const readings: ReadingRow[] = await api.reading.list({
    propertyId: activeTenancy.propertyId,
    limit: 60,
  });

  // Find latest reading per utility type
  const byType = new Map<string, ReadingRow>();
  for (const r of readings) {
    if (!byType.has(r.utilityType)) byType.set(r.utilityType, r);
  }
  const lastVillany = byType.get("villany") ?? null;
  const lastViz = byType.get("viz") ?? null;
  const lastGaz = byType.get("gaz") ?? null;
  const lastCsatorna = byType.get("csatorna") ?? null;

  // Sparkline data (last 12 readings per type, oldest first)
  const sparklineFor = (type: string): number[] =>
    readings
      .filter((r) => r.utilityType === type && r.consumption !== null)
      .slice(0, 12)
      .map((r) => r.consumption ?? 0)
      .reverse();

  const villanySpark = sparklineFor("villany");
  const vizSpark = sparklineFor("viz");
  const gazSpark = sparklineFor("gaz");

  const villanyCost = lastVillany?.costHuf ?? 0;
  const vizCost = lastViz?.costHuf ?? 0;
  const gazCost = lastGaz?.costHuf ?? 0;
  const csatornaCost = lastCsatorna?.costHuf ?? 0;
  const monthlyTotal = villanyCost + vizCost + gazCost + csatornaCost;

  const utilityCards = [
    {
      type: "villany",
      label: "Villany",
      icon: Zap,
      colorClass: "text-amber-500",
      bgClass: "bg-amber-500/10",
      barClass: "bg-amber-500",
      pillBgClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      consumption: lastVillany?.consumption ?? 0,
      cost: villanyCost,
      value: lastVillany?.value ?? null,
      unit: "kWh",
      sparkline: villanySpark,
      date: lastVillany?.readingDate ?? null,
    },
    {
      type: "viz",
      label: "Víz",
      icon: Droplets,
      colorClass: "text-sky-500",
      bgClass: "bg-sky-500/10",
      barClass: "bg-sky-500",
      pillBgClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
      consumption: lastViz?.consumption ?? 0,
      cost: vizCost,
      value: lastViz?.value ?? null,
      unit: "m³",
      sparkline: vizSpark,
      date: lastViz?.readingDate ?? null,
    },
    {
      type: "gaz",
      label: "Gáz",
      icon: Flame,
      colorClass: "text-rose-500",
      bgClass: "bg-rose-500/10",
      barClass: "bg-rose-500",
      pillBgClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
      consumption: lastGaz?.consumption ?? 0,
      cost: gazCost,
      value: lastGaz?.value ?? null,
      unit: "m³",
      sparkline: gazSpark,
      date: lastGaz?.readingDate ?? null,
    },
  ].filter((c) => c.cost > 0 || c.value !== null);

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Üdv,</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {activeTenancy.property.name}
          </h1>
          {activeTenancy.property.address && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {activeTenancy.property.address}
            </p>
          )}
        </div>
        <SignOutButton />
      </div>

      {/* PRIMARY ACTION: New meter reading */}
      <Link
        href="/my-home/readings"
        className="mb-5 block overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 shadow-lg transition hover:shadow-xl active:scale-[0.99]"
      >
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <ClipboardEdit className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-primary-foreground">Mérőállás rögzítése</p>
            <p className="mt-0.5 text-sm text-primary-foreground/80">
              Villany, víz vagy gáz mérőállás felvitele
            </p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-primary-foreground/70" />
        </div>
      </Link>

      {/* Hero: Monthly total */}
      <Link
        href="/my-home/history"
        className="mb-5 block rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Becsült havi költség
          </span>
          <div className="flex items-center gap-2">
            {lastVillany?.readingDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDateShort(lastVillany.readingDate)}
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <p className="mb-4 text-4xl font-extrabold tracking-tight tabular-nums">
          {formatHuf(monthlyTotal)}
        </p>

        <div className="flex flex-wrap gap-2">
          {utilityCards.map((card) => (
            <span
              key={card.type}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${card.pillBgClass}`}
            >
              <card.icon className="h-3 w-3" />
              {formatHuf(card.cost)}
            </span>
          ))}
        </div>
      </Link>

      {/* 3-column stat cards */}
      {utilityCards.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          {utilityCards.map((card) => (
            <Link
              key={card.type}
              href={`/my-home/history?type=${card.type}`}
              className="block rounded-2xl border border-border bg-card p-3 text-center transition hover:border-primary/40"
            >
              <div
                className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${card.bgClass}`}
              >
                <card.icon className={`h-4 w-4 ${card.colorClass}`} />
              </div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <p className="text-sm font-bold tabular-nums">
                {formatNumber(card.consumption)} {card.unit}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {formatHuf(card.cost)}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Utility detail cards with sparklines */}
      {utilityCards.length > 0 && (
        <div className="mb-5 space-y-3">
          {utilityCards.map((card) => (
            <Link
              key={card.type}
              href={`/my-home/history?type=${card.type}`}
              className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bgClass}`}
                  >
                    <card.icon className={`h-5 w-5 ${card.colorClass}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{card.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {card.date ? formatDateShort(card.date) : "Nincs adat"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{formatHuf(card.cost)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(card.consumption)} {card.unit}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </div>

              {card.sparkline.length > 1 && (
                <TenantHomeChart data={card.sparkline} color={`var(--${card.type}-color)`} barClass={card.barClass} />
              )}

              <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
                <div className="text-xs text-muted-foreground">
                  Mérőállás:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {card.value != null
                      ? `${formatNumber(card.value)} ${card.unit}`
                      : "—"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link
          href="/my-home/history"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40"
        >
          <History className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Előzmények</span>
        </Link>
        <Link
          href="/my-home/chat"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40"
        >
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Üzenetek</span>
        </Link>
      </div>

      {/* Property info */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bérleti viszony
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Beköltözés</p>
            <p className="font-medium">
              {activeTenancy.moveInDate
                ? new Date(activeTenancy.moveInDate).toLocaleDateString("hu-HU")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kaució</p>
            <p className="font-medium tabular-nums">
              {activeTenancy.depositAmount != null
                ? `${activeTenancy.depositAmount.toLocaleString("hu-HU")} ${activeTenancy.depositCurrency === "EUR" ? "€" : "Ft"}`
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
