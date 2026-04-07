import { api } from "@/trpc/server";
import Link from "next/link";

export default async function PropertiesPage() {
  const properties = await api.property.list();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ingatlanok</h1>
        <Link
          href="/properties/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Új ingatlan
        </Link>
      </div>

      {properties.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Még nincs ingatlanod. Hozd létre az elsőt!
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
                {property.address}
              </p>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span>{property.meterInfo.length} mérő</span>
                <span>
                  {property.tenancies.length > 0
                    ? `Bérlő: ${property.tenancies[0]?.tenant.firstName ?? property.tenancies[0]?.tenant.email}`
                    : "Nincs bérlő"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
