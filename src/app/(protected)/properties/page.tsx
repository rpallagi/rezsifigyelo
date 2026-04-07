import { api } from "@/trpc/server";
import { formatNumber, getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import Link from "next/link";

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
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="rounded-lg border border-border p-6 hover:bg-secondary/50"
            >
              <h3 className="font-semibold">{property.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {property.address ?? m.common.noAddress}
              </p>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span>
                  {formatNumber(property.meterInfo.length, locale)} {m.common.metersSuffix}
                </span>
                <span>
                  {property.tenancies.length > 0
                    ? `${m.propertiesPage.tenantPrefix}: ${property.tenancies[0]?.tenant.firstName ?? property.tenancies[0]?.tenant.email}`
                    : m.common.noTenant}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
