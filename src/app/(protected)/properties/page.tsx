import React from "react";
import { api } from "@/trpc/server";
import { formatNumber, getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { PropertyCoverImage } from "@/components/properties/property-cover-image";
import { ViewSwitcher } from "./view-switcher";

function profileBadgeColor(color: string | null) {
  const map: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  };
  return map[color ?? ""] ?? map.slate!;
}

function profileDotColor(color: string | null) {
  const map: Record<string, string> = {
    blue: "bg-blue-500", emerald: "bg-emerald-500", purple: "bg-purple-500",
    amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-sky-500",
    orange: "bg-orange-500", slate: "bg-slate-500",
  };
  return map[color ?? ""] ?? "bg-slate-500";
}

function propertyTypeLabel(propertyType: string) {
  const builtIn: Record<string, string> = {
    lakas: "Lakás", uzlet: "Üzlet", telek: "Telek", egyeb: "Egyéb",
  };
  return builtIn[propertyType] ?? propertyType;
}

function propertyPlaceholder(propertyType: string) {
  switch (propertyType) {
    case "lakas":
      return "linear-gradient(135deg, rgba(70,72,212,0.92), rgba(96,99,238,0.75)), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 42%)";
    case "uzlet":
      return "linear-gradient(135deg, rgba(0,108,73,0.92), rgba(108,248,187,0.68)), radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 40%)";
    case "telek":
      return "linear-gradient(135deg, rgba(131,81,0,0.9), rgba(255,185,95,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 40%)";
    default:
      return "linear-gradient(135deg, rgba(25,28,30,0.9), rgba(118,117,134,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 42%)";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ListRow({ property, m }: { property: any; m: any }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="flex items-center gap-4 rounded-[16px] border border-border/60 bg-card/95 p-3 transition hover:bg-secondary/40"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <PropertyCoverImage
          imageUrl={property.avatarUrl}
          title={property.name}
          className="h-full w-full object-cover"
          placeholderClassName="h-full w-full"
          placeholderBackground={propertyPlaceholder(property.propertyType)}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{property.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {property.address ?? m.common.noAddress}
        </p>
      </div>
      <span className="hidden text-xs sm:block">
        {propertyTypeLabel(property.propertyType)}
      </span>
      {property.landlordProfile && (
        <span className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold md:inline-flex ${profileBadgeColor(property.landlordProfile.color)}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${profileDotColor(property.landlordProfile.color)}`} />
          {property.landlordProfile.displayName}
        </span>
      )}
      <span className="hidden text-xs text-muted-foreground lg:block">
        {property.tenancies.length > 0
          ? property.tenancies[0]?.tenant?.firstName ?? property.tenancies[0]?.tenantName ?? property.tenancies[0]?.tenant?.email ?? property.tenancies[0]?.tenantEmail ?? ""
          : m.common.noTenant}
      </span>
    </Link>
  );
}

function buildUrl(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
) {
  const merged = { ...base, ...overrides };
  const qs = Object.entries(merged)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; profile?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const cookieStore = await cookies();
  const view =
    params.view ??
    cookieStore.get("rezsi-property-view")?.value ??
    "grid";
  const properties = await api.property.list();

  // --- Profile filter ---
  const profileFilter = params.profile ? Number(params.profile) : null;
  const uniqueProfiles = [
    ...new Map(
      properties
        .filter((p) => p.landlordProfile)
        .map((p) => [p.landlordProfile!.id, p.landlordProfile!]),
    ).values(),
  ];
  const filteredProperties = profileFilter
    ? properties.filter((p) => p.landlordProfile?.id === profileFilter)
    : properties;

  // Base params to preserve across links
  const baseParams: Record<string, string | undefined> = {
    view: params.view,
    profile: params.profile,
    sort: params.sort,
    dir: params.dir,
  };

  // --- Sorting (table view) ---
  const sort = params.sort ?? "name";
  const dir = params.dir === "desc" ? "desc" : "asc";
  const sortedProperties = [...filteredProperties].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";
    switch (sort) {
      case "name":
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case "address":
        aVal = (a.address ?? "").toLowerCase();
        bVal = (b.address ?? "").toLowerCase();
        break;
      case "type":
        aVal = a.propertyType;
        bVal = b.propertyType;
        break;
      case "rent":
        aVal = a.monthlyRent ?? 0;
        bVal = b.monthlyRent ?? 0;
        break;
      case "area":
        aVal = a.buildingArea ?? 0;
        bVal = b.buildingArea ?? 0;
        break;
      case "profile":
        aVal = (a.landlordProfile?.displayName ?? "").toLowerCase();
        bVal = (b.landlordProfile?.displayName ?? "").toLowerCase();
        break;
      default:
        break;
    }
    if (aVal < bVal) return dir === "asc" ? -1 : 1;
    if (aVal > bVal) return dir === "asc" ? 1 : -1;
    return 0;
  });

  // Group by profile for list/table when no filter active
  const groupedByProfile = !profileFilter
    ? (() => {
        const groups: { profile: typeof uniqueProfiles[number] | null; items: typeof sortedProperties }[] = [];
        const profileMap = new Map<number | null, typeof sortedProperties>();
        for (const p of sortedProperties) {
          const key = p.landlordProfile?.id ?? null;
          if (!profileMap.has(key)) profileMap.set(key, []);
          profileMap.get(key)!.push(p);
        }
        // Named profiles first, then unassigned
        for (const prof of uniqueProfiles) {
          const items = profileMap.get(prof.id);
          if (items?.length) groups.push({ profile: prof, items });
        }
        const noProfile = profileMap.get(null);
        if (noProfile?.length) groups.push({ profile: null, items: noProfile });
        return groups.length > 1 ? groups : null;
      })()
    : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{m.propertiesPage.title}</h1>
        <div className="flex items-center gap-3">
          <ViewSwitcher active={view} />
          <Link
            href="/properties/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {m.propertiesPage.create}
          </Link>
        </div>
      </div>

      {/* Profile filter pills */}
      {uniqueProfiles.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/properties${buildUrl(baseParams, { profile: undefined })}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !profileFilter
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Összes
          </Link>
          {uniqueProfiles.map((prof) => (
            <Link
              key={prof.id}
              href={`/properties${buildUrl(baseParams, { profile: String(prof.id) })}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                profileFilter === prof.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${profileDotColor(prof.color)}`} />
              {prof.displayName}
            </Link>
          ))}
        </div>
      )}

      {properties.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {m.propertiesPage.empty}
        </p>
      ) : filteredProperties.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Nincs ingatlan ebben a profilban.
        </p>
      ) : (
        <>
        {/* Grid view (default — big cards) */}
        {view === "grid" && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProperties.map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="group overflow-hidden rounded-[28px] border border-border/60 bg-card/95 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
              >
                <div className="relative h-[180px] overflow-hidden">
                  <PropertyCoverImage
                    imageUrl={property.avatarUrl}
                    title={property.name}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    placeholderClassName="absolute inset-0 h-full w-full"
                    placeholderBackground={propertyPlaceholder(property.propertyType)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900 shadow-sm">
                    {propertyTypeLabel(property.propertyType)}
                  </div>
                  <div className="absolute inset-x-4 bottom-4">
                    <h3 className="line-clamp-2 text-xl font-semibold tracking-tight text-white">
                      {property.name}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-sm text-white/72">
                      {property.address ?? m.common.noAddress}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  {property.handoverChecklists.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        {property.handoverChecklists.length} nyitott teendő
                      </span>
                    </div>
                  )}
                  {property.landlordProfile && (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${profileBadgeColor(property.landlordProfile.color)}`}>
                        <span className={`h-2 w-2 rounded-full ${profileDotColor(property.landlordProfile.color)}`} />
                        {property.landlordProfile.displayName}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] bg-background/75 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Mérők
                      </p>
                      <p className="mt-1 text-base font-semibold">
                        {formatNumber(property.meterInfo.length, locale)}
                      </p>
                    </div>
                    <div className="rounded-[20px] bg-background/75 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Bérleti díj
                      </p>
                      <p className="mt-1 text-base font-semibold">
                        {property.monthlyRent
                          ? `${Math.round(property.monthlyRent).toLocaleString(locale === "hu" ? "hu-HU" : "en-US")} ${property.rentCurrency === "EUR" ? "€" : "Ft"}${property.buildingArea ? ` · ${Math.round(property.monthlyRent / property.buildingArea).toLocaleString(locale === "hu" ? "hu-HU" : "en-US")} ${property.rentCurrency === "EUR" ? "€" : "Ft"}/m²` : ""}`
                          : "Nincs"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-background/70 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Bérlő státusz
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {property.tenancies.length > 0
                        ? `${m.propertiesPage.tenantPrefix}: ${property.tenancies[0]?.tenant?.firstName ?? property.tenancies[0]?.tenantName ?? property.tenancies[0]?.tenant?.email ?? property.tenancies[0]?.tenantEmail ?? ""}`
                        : m.common.noTenant}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Compact view — smaller cards, 4 columns */}
        {view === "compact" && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filteredProperties.map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="group overflow-hidden rounded-[20px] border border-border/60 bg-card/95 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
              >
                <div className="relative h-[100px] overflow-hidden rounded-[14px]">
                  <PropertyCoverImage
                    imageUrl={property.avatarUrl}
                    title={property.name}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    placeholderClassName="absolute inset-0 h-full w-full"
                    placeholderBackground={propertyPlaceholder(property.propertyType)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <p className="mt-2 truncate text-sm font-semibold">{property.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {propertyTypeLabel(property.propertyType)}
                  </span>
                  {property.landlordProfile && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${profileBadgeColor(property.landlordProfile.color)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${profileDotColor(property.landlordProfile.color)}`} />
                      {property.landlordProfile.displayName}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* List view — rows with small thumbnail */}
        {view === "list" && (
          <div className="mt-6 space-y-2">
            {groupedByProfile ? (
              groupedByProfile.map((group) => (
                <div key={group.profile?.id ?? "none"}>
                  <div className="flex items-center gap-3 px-1 py-2">
                    {group.profile && (
                      <span className={`h-2.5 w-2.5 rounded-full ${profileDotColor(group.profile.color)}`} />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.profile?.displayName ?? "Profil nélkül"}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  {group.items.map((property) => (
                    <ListRow key={property.id} property={property} m={m} />
                  ))}
                </div>
              ))
            ) : (
              filteredProperties.map((property) => (
                <ListRow key={property.id} property={property} m={m} />
              ))
            )}
          </div>
        )}

        {/* Table view */}
        {view === "table" && (() => {
          const sortColumns = [
            { key: "name", label: "Név" },
            { key: "address", label: "Cím" },
            { key: "type", label: "Típus" },
            { key: null, label: "Bérlő" },
            { key: "rent", label: "Bérleti díj" },
            { key: "area", label: "m²" },
            { key: "profile", label: "Profil" },
          ] as const;

          const renderTableRow = (property: typeof sortedProperties[number]) => (
            <tr
              key={property.id}
              className="border-b last:border-b-0 transition hover:bg-secondary/30"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/properties/${property.id}`}
                  className="font-medium hover:underline"
                >
                  {property.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {property.address ?? m.common.noAddress}
              </td>
              <td className="px-4 py-3">
                {propertyTypeLabel(property.propertyType)}
              </td>
              <td className="px-4 py-3">
                {property.tenancies.length > 0
                  ? property.tenancies[0]?.tenant?.firstName ?? property.tenancies[0]?.tenantName ?? property.tenancies[0]?.tenant?.email ?? property.tenancies[0]?.tenantEmail ?? ""
                  : m.common.noTenant}
              </td>
              <td className="px-4 py-3">
                {property.monthlyRent
                  ? `${Math.round(property.monthlyRent).toLocaleString(locale === "hu" ? "hu-HU" : "en-US")} ${property.rentCurrency === "EUR" ? "€" : "Ft"}`
                  : "Nincs"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {property.buildingArea ? `${property.buildingArea} m²` : "—"}
                {property.buildingArea && property.monthlyRent && (
                  <span className="ml-1 text-xs opacity-70">
                    ({Math.round(property.monthlyRent / property.buildingArea).toLocaleString(locale === "hu" ? "hu-HU" : "en-US")} /m²)
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {property.landlordProfile ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${profileBadgeColor(property.landlordProfile.color)}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${profileDotColor(property.landlordProfile.color)}`} />
                    {property.landlordProfile.displayName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          );

          return (
            <div className="mt-6 overflow-auto rounded-[16px] border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    {sortColumns.map((col) =>
                      col.key ? (
                        <th key={col.key} className="px-4 py-3 font-semibold">
                          <Link
                            href={`/properties${buildUrl(baseParams, {
                              sort: col.key,
                              dir: sort === col.key && dir === "asc" ? "desc" : "asc",
                            })}`}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            {col.label}
                            {sort === col.key && (
                              <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>
                            )}
                          </Link>
                        </th>
                      ) : (
                        <th key={col.label} className="px-4 py-3 font-semibold">
                          {col.label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {groupedByProfile ? (
                    groupedByProfile.map((group) => (
                      <React.Fragment key={group.profile?.id ?? "none"}>
                        <tr>
                          <td colSpan={7} className="px-4 pb-1 pt-4">
                            <div className="flex items-center gap-2">
                              {group.profile && (
                                <span className={`h-2.5 w-2.5 rounded-full ${profileDotColor(group.profile.color)}`} />
                              )}
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {group.profile?.displayName ?? "Profil nélkül"}
                              </span>
                              <span className="h-px flex-1 bg-border" />
                            </div>
                          </td>
                        </tr>
                        {group.items.map(renderTableRow)}
                      </React.Fragment>
                    ))
                  ) : (
                    sortedProperties.map(renderTableRow)
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
        </>
      )}
    </div>
  );
}
