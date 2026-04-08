import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { ConsumptionChart } from "@/components/shared/consumption-chart";

export default async function TenantHistoryPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const activeTenancy = await api.tenancy.myActive();

  if (!activeTenancy) {
    redirect("/my-home");
  }

  const readings = await api.reading.list({
    propertyId: activeTenancy.propertyId,
    limit: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">{m.common.history}</h1>

      {readings.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          {m.tenantShell.historyPlaceholder}
        </p>
      ) : (
        <>
          <ConsumptionChart
            readings={readings.map((reading) => ({
              readingDate: reading.readingDate,
              consumption: reading.consumption,
              utilityType: reading.utilityType,
            }))}
          />

          <div className="mt-6 space-y-3">
            {readings.map((reading) => (
              <div
                key={reading.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {m.utilities[reading.utilityType] ?? reading.utilityType}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reading.readingDate}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p>
                      {m.tenantShell.readingValue}:{" "}
                      <span className="font-semibold">{reading.value}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {m.tenantShell.consumptionLabel}:{" "}
                      {reading.consumption ?? m.common.none}
                    </p>
                    <p className="text-muted-foreground">
                      {m.tenantShell.costLabel}:{" "}
                      {reading.costHuf != null
                        ? `${reading.costHuf.toLocaleString(locale === "en" ? "en-US" : "hu-HU")} ${m.common.currencyCode}`
                        : m.common.none}
                    </p>
                  </div>
                </div>
                {reading.photoUrl && (
                  <a
                    href={reading.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm text-primary hover:underline"
                  >
                    {m.tenantShell.viewPhoto}
                  </a>
                )}
                {reading.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {reading.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
