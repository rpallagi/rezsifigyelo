import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ConsumptionChart } from "@/components/shared/consumption-chart";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
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
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href={`/properties/${property.id}/readings/new`}
          className="rounded-md bg-primary px-4 py-3 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Mérőállás rögzítés
        </Link>
        <Link
          href={`/properties/${property.id}/payments/new`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + Befizetés rögzítés
        </Link>
        <Link
          href={`/billing?propertyId=${property.id}`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + Számla
        </Link>
        <Link
          href={`/properties/${property.id}/meters/new`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + Mérőóra
        </Link>
        <Link
          href={`/properties/${property.id}/maintenance/new`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + Karbantartás
        </Link>
        <Link
          href={`/properties/${property.id}/wifi/new`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + WiFi
        </Link>
        <Link
          href={`/properties/${property.id}/edit`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          Szerkesztés
        </Link>
        <Link
          href={`/properties/${property.id}/marketing`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          Marketing
        </Link>
        <Link
          href={`/properties/${property.id}/chat`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          Chat
        </Link>
        <Link
          href={`/properties/${property.id}/documents/new`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + Dokumentum
        </Link>
        <Link
          href={`/properties/${property.id}/common-fees/new`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + Közös ktg.
        </Link>
        <Link
          href={`/properties/${property.id}/tax/new`}
          className="rounded-md border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          + Adó
        </Link>
        {!activeTenancy && (
          <Link
            href={`/properties/${property.id}/move-in`}
            className="rounded-md bg-green-600 px-4 py-3 text-sm text-white hover:bg-green-700"
          >
            + Bérlő hozzáadása
          </Link>
        )}
        {activeTenancy && (
          <Link
            href={`/properties/${property.id}/move-out`}
            className="rounded-md bg-red-600 px-4 py-3 text-sm text-white hover:bg-red-700"
          >
            Kiköltözés
          </Link>
        )}
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
          {!activeTenancy && (
            <Link
              href={`/properties/${property.id}/move-in`}
              className="mt-3 inline-flex rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              Bérlő meghívása
            </Link>
          )}
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

      {/* Consumption chart */}
      <ConsumptionChart
        readings={property.readings.map((r) => ({
          readingDate: r.readingDate,
          consumption: r.consumption,
          utilityType: r.utilityType,
        }))}
      />

      {/* Recent readings */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Utolsó mérőállások</h2>
        {property.readings.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Még nincs mérőállás rögzítve.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Dátum</th>
                <th className="pb-2 font-medium">Közmű</th>
                <th className="pb-2 font-medium">Állás</th>
                <th className="pb-2 font-medium">Fogyasztás</th>
                <th className="pb-2 font-medium">Költség</th>
                <th className="pb-2 font-medium">Fotó</th>
              </tr>
            </thead>
            <tbody>
              {property.readings.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.readingDate}</td>
                  <td className="py-2 capitalize">{r.utilityType}</td>
                  <td className="py-2">{r.value}</td>
                  <td className="py-2">
                    {r.consumption ?? "—"}
                  </td>
                  <td className="py-2">
                    {r.costHuf != null
                      ? `${r.costHuf.toLocaleString("hu-HU")} Ft`
                      : "—"}
                  </td>
                  <td className="py-2">
                    {r.photoUrl ? (
                      <a
                        href={r.photoUrl}
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
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
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
          </div>
        )}
      </div>

      {property.invoices.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Számlák</h2>
          <div className="mt-4 space-y-3">
            {property.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {invoice.invoiceNumber ?? `#${invoice.id}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.issueDate}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">
                      {invoice.grossTotalHuf.toLocaleString("hu-HU")} Ft
                    </p>
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm text-primary hover:underline"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance */}
      {property.maintenanceLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Karbantartás</h2>
          <div className="mt-4 space-y-3">
            {property.maintenanceLogs.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm">{m.description}</p>
                    {m.category && (
                      <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
                        {m.category}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {m.performedDate && <p>{m.performedDate}</p>}
                    {m.costHuf != null && m.costHuf > 0 && (
                      <p className="font-medium text-foreground">
                        {m.costHuf.toLocaleString("hu-HU")} Ft
                      </p>
                    )}
                  </div>
                </div>
                {m.performedBy && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.performedBy}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
      {/* Documents */}
      {property.documents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Dokumentumok</h2>
          <div className="mt-4 space-y-2">
            {property.documents.map((d) => (
              <a
                key={d.id}
                href={d.storedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/50"
              >
                <div>
                  <p className="text-sm font-medium">{d.filename}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {d.category.replace("_", " ")}
                    {d.fileSize && ` · ${(d.fileSize / 1024).toFixed(0)} KB`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(d.uploadedAt).toLocaleDateString("hu-HU")}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Common fees */}
      {property.commonFees.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Közös költség</h2>
          <div className="mt-4 space-y-3">
            {property.commonFees.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {f.monthlyAmount.toLocaleString("hu-HU")} Ft / {f.frequency === "monthly" ? "hó" : "negyedév"}
                    </p>
                    {f.recipient && (
                      <p className="text-sm text-muted-foreground">{f.recipient}</p>
                    )}
                  </div>
                  {f.bankAccount && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {f.bankAccount}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property taxes */}
      {property.propertyTaxes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Ingatlanadó</h2>
          <div className="mt-4 space-y-3">
            {property.propertyTaxes.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {t.year} — {t.annualAmount.toLocaleString("hu-HU")} Ft/év
                  </p>
                  <div className="flex gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        t.autumnPaid
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}
                    >
                      Ősz {t.autumnPaid ? "✓" : "✗"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        t.springPaid
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}
                    >
                      Tavasz {t.springPaid ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
