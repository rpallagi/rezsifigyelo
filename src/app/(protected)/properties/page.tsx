import { api } from "@/trpc/server";
import { formatNumber, getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import Link from "next/link";

function propertyTypeLabel(propertyType: string) {
  switch (propertyType) {
    case "lakas":
      return "Lakás";
    case "uzlet":
      return "Üzlet";
    case "telek":
      return "Telek";
    default:
      return "Egyéb";
  }
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

export default async function PropertiesPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const properties = await api.property.list();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{m.propertiesPage.title}</h1>
        <Link
          href="/properties/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          {m.propertiesPage.create}
        </Link>
      </div>

      {properties.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {m.propertiesPage.empty}
        </p>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="group overflow-hidden rounded-[28px] border border-border/60 bg-card/95 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
            >
              <div className="relative h-[180px] overflow-hidden">
                {property.avatarUrl ? (
                  <img
                    src={property.avatarUrl}
                    alt={property.name}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    className="absolute inset-0 h-full w-full"
                    style={{ background: propertyPlaceholder(property.propertyType) }}
                  />
                )}
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
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      property.landlordProfile.profileType === "company"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : property.landlordProfile.profileType === "co_ownership"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    }`}>
                      {property.landlordProfile.profileType === "company"
                        ? "Cég"
                        : property.landlordProfile.profileType === "co_ownership"
                          ? "Közösség"
                          : "Magán"}
                      <span className="normal-case tracking-normal">· {property.landlordProfile.displayName}</span>
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
                        ? `${Math.round(property.monthlyRent).toLocaleString(locale === "hu" ? "hu-HU" : "en-US")} Ft`
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
    </div>
  );
}
