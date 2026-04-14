import { api } from "@/trpc/server";
import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import Link from "next/link";
import { InvitationActions } from "./invitation-actions";
import { TenantEditActions } from "./tenant-edit-actions";

export default async function TenantsPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const [properties, pendingInvitations] = await Promise.all([
    api.property.list(),
    api.tenancy.pendingInvitations(),
  ]);

  const allTenancies = properties.flatMap((p) =>
    p.tenancies.map((t) => ({ ...t, propertyName: p.name })),
  );
  const vacantProperties = properties.filter(
    (property) => !property.tenancies.some((tenancy) => tenancy.active),
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m.tenantsPage.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bérlőt az ingatlanhoz kötve tudsz felvenni. Ha megadod az email címet,
            a rendszer meghívót küld és aktiválja a bérlői hozzáférést.
          </p>
        </div>
        <Link
          href="/properties"
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          Ingatlanok megnyitása
        </Link>
      </div>

      {vacantProperties.length > 0 && (
        <div className="mt-6 rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold">Bérlő nélkül álló ingatlanok</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {vacantProperties.map((property) => (
              <div
                key={property.id}
                className="rounded-lg border border-border p-4"
              >
                <p className="font-medium">{property.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {property.address ?? m.common.noAddress}
                </p>
                <Link
                  href={`/properties/${property.id}/move-in`}
                  className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  Bérlő hozzáadása
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingInvitations.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/20">
          <h2 className="text-lg font-semibold">Függő bérlő meghívók</h2>
          <div className="mt-4 space-y-3">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="rounded-lg border border-amber-300/60 bg-background p-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {invitation.tenantName ?? invitation.tenantEmail}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invitation.tenantEmail}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {invitation.property.name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                      Meghívó elküldve
                    </span>
                    <InvitationActions invitationId={invitation.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allTenancies.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {m.tenantsPage.empty}
        </p>
      ) : (
        <div className="mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">{m.common.name}</th>
                <th className="pb-3 font-medium">{m.common.email}</th>
                <th className="pb-3 font-medium">Telefon</th>
                <th className="pb-3 font-medium">{m.tenantsPage.property}</th>
                <th className="pb-3 font-medium">{m.common.status}</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {allTenancies.map((t) => {
                const displayName = t.tenant
                  ? [t.tenant.firstName, t.tenant.lastName].filter(Boolean).join(" ") || ""
                  : t.tenantName ?? "";
                const displayEmail = t.tenant?.email ?? t.tenantEmail ?? "";
                const displayPhone = t.tenantPhone ?? "";
                return (
                  <tr key={t.id} className="border-b">
                    <td className="py-3">
                      {displayName}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {displayEmail}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {displayPhone || "—"}
                    </td>
                    <td className="py-3">{t.propertyName}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          t.active
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {t.active ? m.common.active : m.common.inactive}
                      </span>
                    </td>
                    <td className="py-3">
                      {t.active && (
                        <TenantEditActions
                          tenancyId={t.id}
                          initialName={displayName}
                          initialEmail={displayEmail}
                          initialPhone={displayPhone}
                          initialAddress={t.tenantAddress ?? ""}
                          initialMotherName={t.tenantMotherName ?? ""}
                          initialBirthPlace={t.tenantBirthPlace ?? ""}
                          initialBirthDate={t.tenantBirthDate ?? ""}
                          initialTenantType={t.tenantType ?? "individual"}
                          initialTaxNumber={t.tenantTaxNumber ?? ""}
                          initialBillingName={t.billingName ?? ""}
                          initialBillingEmail={t.billingEmail ?? ""}
                          initialBillingAddress={t.billingAddress ?? ""}
                          initialBillingTaxNumber={t.billingTaxNumber ?? ""}
                          initialBillingBuyerType={t.billingBuyerType ?? "individual"}
                          initialDepositAmount={t.depositAmount ?? undefined}
                          initialDepositCurrency={t.depositCurrency ?? "HUF"}
                          initialLeaseMonths={t.leaseMonths ?? undefined}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
