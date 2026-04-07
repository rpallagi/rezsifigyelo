import { api } from "@/trpc/server";
import {
  formatCurrency,
  formatNumber,
  getMessages,
} from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import Link from "next/link";

export default async function DashboardPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const user = await api.user.me();
  const properties = await api.property.list();

  const totalProperties = properties.length;
  const activeTenants = properties.reduce(
    (acc, p) => acc + p.tenancies.filter((t) => t.active).length,
    0,
  );
  const totalMeters = properties.reduce(
    (acc, p) => acc + p.meterInfo.length,
    0,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {m.dashboardPage.greeting}, {user.firstName ?? user.email}!
      </h1>
      <p className="mt-2 text-muted-foreground">
        {m.dashboardPage.welcome}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Link
          href="/properties"
          className="rounded-lg border border-border p-6 hover:bg-secondary/50"
        >
          <h3 className="text-sm font-medium text-muted-foreground">
            {m.dashboardPage.totalProperties}
          </h3>
          <p className="mt-2 text-3xl font-bold">{formatNumber(totalProperties, locale)}</p>
        </Link>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            {m.dashboardPage.activeTenants}
          </h3>
          <p className="mt-2 text-3xl font-bold">{formatNumber(activeTenants, locale)}</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            {m.dashboardPage.totalMeters}
          </h3>
          <p className="mt-2 text-3xl font-bold">{formatNumber(totalMeters, locale)}</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            {m.dashboardPage.monthlyRevenue}
          </h3>
          <p className="mt-2 text-3xl font-bold">
            {formatCurrency(
              properties.reduce((acc, p) => acc + (p.monthlyRent ?? 0), 0),
              locale,
            )}
          </p>
        </div>
      </div>

      {/* Recent properties */}
      {properties.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">{m.dashboardPage.recentProperties}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {properties.slice(0, 6).map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="rounded-lg border border-border p-4 hover:bg-secondary/50"
              >
                <h3 className="font-medium">{property.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {property.address ?? m.common.noAddress}
                </p>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>
                    {formatNumber(property.meterInfo.length, locale)} {m.common.metersSuffix}
                  </span>
                  {property.tenancies.length > 0 && (
                    <span>
                      {property.tenancies[0]?.tenant.firstName ??
                        property.tenancies[0]?.tenant.email}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {properties.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {m.dashboardPage.empty}
          </p>
          <Link
            href="/properties/new"
            className="mt-4 inline-block rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {m.dashboardPage.createProperty}
          </Link>
        </div>
      )}
    </div>
  );
}
