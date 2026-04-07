import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import Link from "next/link";

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
  const property = await api.property.get({ id: numId });

  if (!property) {
    notFound();
  }

  const activeTenancy = property.tenancies.find((t) => t.active);

  return (
    <div>
      <div className="flex items-center gap-4">
        <Link
          href="/properties"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Vissza
        </Link>
        <h1 className="text-2xl font-bold">{property.name}</h1>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
          {property.propertyType}
        </span>
      </div>

      {property.address && (
        <p className="mt-2 text-muted-foreground">{property.address}</p>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/properties/${property.id}/readings/new`}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Mérőállás rögzítés
        </Link>
        <Link
          href={`/properties/${property.id}/payments/new`}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          + Befizetés rögzítés
        </Link>
        <Link
          href={`/properties/${property.id}/meters/new`}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          + Mérőóra
        </Link>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm text-muted-foreground">Bérlő</h3>
          <p className="mt-1 font-semibold">
            {activeTenancy
              ? `${activeTenancy.tenant.firstName ?? ""} ${activeTenancy.tenant.lastName ?? activeTenancy.tenant.email}`
              : "Nincs"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm text-muted-foreground">Mérők</h3>
          <p className="mt-1 font-semibold">{property.meterInfo.length} db</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm text-muted-foreground">Utolsó leolvasás</h3>
          <p className="mt-1 font-semibold">
            {property.readings.length > 0
              ? property.readings[0]!.readingDate
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm text-muted-foreground">Havi bérleti díj</h3>
          <p className="mt-1 font-semibold">
            {property.monthlyRent
              ? `${property.monthlyRent.toLocaleString("hu-HU")} Ft`
              : "—"}
          </p>
        </div>
      </div>

      {/* Meters */}
      {property.meterInfo.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Mérőórák</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {property.meterInfo.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-border p-4"
              >
                <p className="font-medium capitalize">{m.utilityType}</p>
                {m.serialNumber && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {m.serialNumber}
                  </p>
                )}
                {m.location && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.location}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent readings */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Utolsó mérőállások</h2>
        {property.readings.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Még nincs mérőállás rögzítve.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Dátum</th>
                <th className="pb-2 font-medium">Közmű</th>
                <th className="pb-2 font-medium">Állás</th>
                <th className="pb-2 font-medium">Fogyasztás</th>
                <th className="pb-2 font-medium">Költség</th>
              </tr>
            </thead>
            <tbody>
              {property.readings.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.readingDate}</td>
                  <td className="py-2 capitalize">{r.utilityType}</td>
                  <td className="py-2">{r.value}</td>
                  <td className="py-2">
                    {r.consumption != null ? r.consumption : "—"}
                  </td>
                  <td className="py-2">
                    {r.costHuf != null
                      ? `${r.costHuf.toLocaleString("hu-HU")} Ft`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent payments */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Befizetések</h2>
        {property.payments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Még nincs befizetés rögzítve.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Dátum</th>
                <th className="pb-2 font-medium">Összeg</th>
                <th className="pb-2 font-medium">Mód</th>
                <th className="pb-2 font-medium">Megjegyzés</th>
              </tr>
            </thead>
            <tbody>
              {property.payments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{p.paymentDate}</td>
                  <td className="py-2">
                    {p.amountHuf.toLocaleString("hu-HU")} Ft
                  </td>
                  <td className="py-2">{p.paymentMethod ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">
                    {p.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* WiFi */}
      {property.wifiNetworks.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">WiFi hálózatok</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {property.wifiNetworks.map((w) => (
              <div
                key={w.id}
                className="rounded-lg border border-border p-4"
              >
                <p className="font-medium">{w.ssid}</p>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {w.password ?? "—"}
                </p>
                {w.location && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {w.location}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
