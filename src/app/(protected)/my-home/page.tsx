import { api } from "@/trpc/server";
import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConsumptionChart } from "@/components/shared/consumption-chart";

export default async function TenantHomePage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const user = await api.user.me();

  if (user.role !== "tenant") {
    redirect("/dashboard");
  }

  const activeTenancy = await api.tenancy.myActive();
  const readings = activeTenancy
    ? await api.reading.list({
        propertyId: activeTenancy.propertyId,
        limit: 24,
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {m.dashboardPage.greeting}, {user.firstName ?? user.email}!
      </h1>
      <p className="mt-2 text-muted-foreground">
        {activeTenancy?.property
          ? `${m.tenantShell.currentHome}: ${activeTenancy.property.name}`
          : m.tenantShell.welcome}
      </p>

      {activeTenancy?.property?.address && (
        <p className="mt-1 text-sm text-muted-foreground">
          {activeTenancy.property.address}
        </p>
      )}

      {activeTenancy && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{m.common.property}</p>
              <p className="mt-1 font-semibold">{activeTenancy.property.name}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{m.tenantShell.moveInDate}</p>
              <p className="mt-1 font-semibold">
                {activeTenancy.moveInDate ?? m.common.none}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{m.tenantShell.deposit}</p>
              <p className="mt-1 font-semibold">
                {activeTenancy.depositAmount != null
                  ? `${activeTenancy.depositAmount.toLocaleString(locale === "en" ? "en-US" : "hu-HU")} ${m.common.currencyCode}`
                  : m.common.none}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">{m.tenantShell.status}</p>
              <p className="mt-1 font-semibold">{m.common.active}</p>
            </div>
          </div>

          <ConsumptionChart
            readings={readings.map((reading) => ({
              readingDate: reading.readingDate,
              consumption: reading.consumption,
              utilityType: reading.utilityType,
            }))}
          />
        </>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link
          href="/my-home/readings"
          className="rounded-lg border border-border p-6 hover:bg-secondary/50"
        >
          <h3 className="font-semibold">{m.tenantShell.recordReading}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.tenantShell.recordReadingDescription}
          </p>
        </Link>
        <Link
          href="/my-home/history"
          className="rounded-lg border border-border p-6 hover:bg-secondary/50"
        >
          <h3 className="font-semibold">{m.common.history}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.tenantShell.historyDescription}
          </p>
        </Link>
        <Link
          href="/my-home/chat"
          className="rounded-lg border border-border p-6 hover:bg-secondary/50"
        >
          <h3 className="font-semibold">{m.common.messages}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.tenantShell.chatDescription}
          </p>
        </Link>
      </div>

      {!activeTenancy && (
        <div className="mt-6 rounded-lg border border-border p-4 text-sm text-muted-foreground">
          {m.tenantShell.noTenancy}
        </div>
      )}
    </div>
  );
}
