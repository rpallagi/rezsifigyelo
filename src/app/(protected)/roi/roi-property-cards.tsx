"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid, List, ArrowUpDown } from "lucide-react";
import { PropertyCoverImage } from "@/components/properties/property-cover-image";

type ROIProperty = {
  id: number;
  name: string;
  address: string | null;
  avatarUrl: string | null;
  propertyType: string;
  roi: number;
  breakEvenYears: number | null;
  monthlyRentDisplay: string;
  isEur: boolean;
  eurDetail: string | null;
  maintenanceDisplay: string;
  maintenanceIsEstimate: boolean;
  placeholderBg: string;
  typeLabel: string;
};

type SortKey = "roi-desc" | "roi-asc" | "name" | "breakeven";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function ROIPropertyCards({
  properties,
  copy,
}: {
  properties: ROIProperty[];
  copy: {
    highestYield: string;
    netRent: string;
    maintenance: string;
    breakEvenStatus: string;
    remaining: string;
  };
}) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [sort, setSort] = useState<SortKey>("roi-desc");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sorted = [...properties].sort((a, b) => {
    switch (sort) {
      case "roi-asc":
        return a.roi - b.roi;
      case "name":
        return a.name.localeCompare(b.name);
      case "breakeven":
        return (a.breakEvenYears ?? Infinity) - (b.breakEvenYears ?? Infinity);
      default:
        return b.roi - a.roi;
    }
  });

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="roi-desc">ROI ↓ (legnagyobb)</option>
            <option value="roi-asc">ROI ↑ (legkisebb)</option>
            <option value="breakeven">Megtérülés (leggyorsabb)</option>
            <option value="name">Név</option>
          </select>
          <span className="text-xs text-muted-foreground">{sorted.length} ingatlan</span>
        </div>
        <div className="flex gap-1 rounded-xl border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`rounded-lg p-1.5 transition ${view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-lg p-1.5 transition ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Card view — horizontal scroll */}
      {view === "cards" && (
        <div className="relative">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow-lg ring-1 ring-border/50 transition hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow-lg ring-1 ring-border/50 transition hover:bg-secondary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scroll-smooth pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sorted.map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="group w-[320px] shrink-0 overflow-hidden rounded-[30px] bg-card/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 dark:shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
              >
                <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-[24px]">
                  <PropertyCoverImage
                    imageUrl={property.avatarUrl}
                    title={property.name}
                    className="h-full w-full object-cover"
                    placeholderClassName="h-full w-full"
                    placeholderBackground={property.placeholderBg}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-900 shadow-sm">
                    {property.typeLabel}
                  </div>
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                        ROI
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {formatPercent(property.roi)}
                      </p>
                    </div>
                    <div className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                      {property.breakEvenYears?.toFixed(1) ?? "—"} év
                    </div>
                  </div>
                </div>

                <div className="px-1">
                  <h3 className="truncate font-semibold tracking-tight">{property.name}</h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {property.address ?? "Nincs cím"}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="rounded-[22px] bg-background/75 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {copy.netRent}
                    </p>
                    <p className="mt-1 text-base font-semibold">{property.monthlyRentDisplay}</p>
                    {property.eurDetail && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{property.eurDetail}</p>
                    )}
                  </div>
                  <div className="rounded-[22px] bg-background/75 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {copy.maintenance}
                      {property.maintenanceIsEstimate && (
                        <span className="ml-1 normal-case tracking-normal opacity-60">~becslés</span>
                      )}
                    </p>
                    <p className={`mt-1 text-base font-semibold ${property.maintenanceIsEstimate ? "text-muted-foreground" : "text-rose-600 dark:text-rose-300"}`}>
                      {property.maintenanceDisplay}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] bg-background/70 px-4 py-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span>{copy.breakEvenStatus}</span>
                    <span className="text-primary">
                      {property.breakEvenYears?.toFixed(1) ?? "—"} {copy.remaining}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/60">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${property.breakEvenYears ? Math.max(10, Math.min(100, Math.round(100 / property.breakEvenYears))) : 10}%`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          {sorted.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="flex items-center gap-4 rounded-[16px] border border-border/60 bg-card/95 p-3 transition hover:bg-secondary/40"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <PropertyCoverImage
                  imageUrl={property.avatarUrl}
                  title={property.name}
                  className="h-full w-full object-cover"
                  placeholderClassName="h-full w-full"
                  placeholderBackground={property.placeholderBg}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{property.name}</h3>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {property.typeLabel}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {property.address ?? "Nincs cím"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-primary">{formatPercent(property.roi)}</p>
                <p className="text-xs text-muted-foreground">
                  {property.breakEvenYears?.toFixed(1) ?? "—"} év
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm font-semibold">{property.monthlyRentDisplay}</p>
                <p className="text-xs text-muted-foreground">/hó</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
