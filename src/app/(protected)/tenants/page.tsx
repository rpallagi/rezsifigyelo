import { api } from "@/trpc/server";
import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import Link from "next/link";
import { InvitationActions } from "./invitation-actions";
import { TenantEditActions } from "./tenant-edit-actions";
import { MessageSquare } from "lucide-react";

export default async function TenantsPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const [properties, pendingInvitations] = await Promise.all([
    api.property.list(),
    api.tenancy.pendingInvitations(),
  ]);

  const allTenancies = properties.flatMap((p) =>
    p.tenancies.map((t) => ({ ...t, propertyId: p.id, propertyName: p.name })),
  );
  const activeTenancies = allTenancies.filter((t) => t.active);
  const archivedTenancies = allTenancies.filter((t) => !t.active);
  const vacantProperties = properties.filter(
    (property) => !property.tenancies.some((tenancy) => tenancy.active),
  );

  function formatDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
  }

  function tenantDisplayName(t: typeof allTenancies[number]) {
    if (t.tenant) {
      const name = [t.tenant.firstName, t.tenant.lastName].filter(Boolean).join(" ");
      return name || t.tenantName || t.tenant.email || "—";
    }
    return t.tenantName ?? "—";
  }

  function tenantDisplayEmail(t: typeof allTenancies[number]) {
    return t.tenant?.email ?? t.tenantEmail ?? "";
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m.tenantsPage.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTenancies.length} aktív bérlő · {archivedTenancies.length} archív
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
              <div key={property.id} className="rounded-lg border border-border p-4">
                <Link href={`/properties/${property.id}`} className="font-medium hover:text-primary hover:underline">
                  {property.name}
                </Link>
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
              <div key={invitation.id} className="rounded-lg border border-amber-300/60 bg-background p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{invitation.tenantName ?? invitation.tenantEmail}</p>
                    <p className="text-sm text-muted-foreground">{invitation.tenantEmail}</p>
                    <Link href={`/properties/${invitation.property.id}`} className="mt-1 text-sm text-primary hover:underline">
                      {invitation.property.name}
                    </Link>
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

      {/* Active tenants */}
      {activeTenancies.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Aktív bérlők</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{m.common.name}</th>
                  <th className="px-4 py-3 font-medium">{m.common.email}</th>
                  <th className="px-4 py-3 font-medium">Telefon</th>
                  <th className="px-4 py-3 font-medium">Ingatlan</th>
                  <th className="px-4 py-3 font-medium">Beköltözés</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {activeTenancies.map((t) => {
                  const displayName = tenantDisplayName(t);
                  const displayEmail = tenantDisplayEmail(t);
                  const displayPhone = t.tenantPhone ?? "";
                  return (
                    <tr key={t.id} className="border-b last:border-b-0 transition hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/messages?tenant=${encodeURIComponent(displayName)}`}
                          className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                          title="Üzenet küldése"
                        >
                          {displayName}
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{displayEmail || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{displayPhone || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/properties/${t.propertyId}`} className="text-primary hover:underline">
                          {t.propertyName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(t.moveInDate)}
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Archived tenants */}
      {archivedTenancies.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Archívum ({archivedTenancies.length} volt bérlő)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-secondary/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Név</th>
                  <th className="px-4 py-3 font-medium">Ingatlan</th>
                  <th className="px-4 py-3 font-medium">Időszak</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Telefon</th>
                </tr>
              </thead>
              <tbody>
                {archivedTenancies.map((t) => {
                  const displayName = tenantDisplayName(t);
                  const displayEmail = tenantDisplayEmail(t);
                  return (
                    <tr key={t.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{displayName}</td>
                      <td className="px-4 py-3">
                        <Link href={`/properties/${t.propertyId}`} className="text-primary hover:underline">
                          {t.propertyName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(t.moveInDate)} — {formatDate(t.moveOutDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{displayEmail || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{t.tenantPhone || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allTenancies.length === 0 && (
        <p className="mt-8 text-muted-foreground">{m.tenantsPage.empty}</p>
      )}
    </div>
  );
}
