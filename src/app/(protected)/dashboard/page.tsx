import { api } from "@/trpc/server";
import Link from "next/link";

export default async function DashboardPage() {
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
        Szia, {user.firstName ?? user.email}!
      </h1>
      <p className="mt-2 text-muted-foreground">
        Üdvözlünk a Rezsi Figyelőben.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Link
          href="/properties"
          className="rounded-lg border border-border p-6 hover:bg-secondary/50"
        >
          <h3 className="text-sm font-medium text-muted-foreground">
            Ingatlanok
          </h3>
          <p className="mt-2 text-3xl font-bold">{totalProperties}</p>
        </Link>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Aktív bérlők
          </h3>
          <p className="mt-2 text-3xl font-bold">{activeTenants}</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Mérőórák
          </h3>
          <p className="mt-2 text-3xl font-bold">{totalMeters}</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Havi bevétel
          </h3>
          <p className="mt-2 text-3xl font-bold">
            {properties
              .reduce((acc, p) => acc + (p.monthlyRent ?? 0), 0)
              .toLocaleString("hu-HU")}{" "}
            Ft
          </p>
        </div>
      </div>

      {/* Recent properties */}
      {properties.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Ingatlanok</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {properties.slice(0, 6).map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="rounded-lg border border-border p-4 hover:bg-secondary/50"
              >
                <h3 className="font-medium">{property.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {property.address ?? "Nincs cím"}
                </p>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>{property.meterInfo.length} mérő</span>
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
            Még nincs ingatlanod. Kezdd el a nyilvántartást!
          </p>
          <Link
            href="/properties/new"
            className="mt-4 inline-block rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            + Új ingatlan létrehozása
          </Link>
        </div>
      )}
    </div>
  );
}
