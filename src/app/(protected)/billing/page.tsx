import { api } from "@/trpc/server";

export default async function BillingPage() {
  const subscription = await api.subscription.current();

  return (
    <div>
      <h1 className="text-2xl font-bold">Számlázás</h1>

      <div className="mt-6 rounded-lg border border-border p-6">
        <h3 className="font-semibold">Előfizetés</h3>
        {subscription ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              Státusz:{" "}
              <span className="font-medium capitalize">
                {subscription.status}
              </span>
            </p>
            {subscription.currentPeriodEnd && (
              <p>
                Következő számlázás:{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                  "hu-HU",
                )}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nincs aktív előfizetésed. A Rezsi Figyelő jelenleg ingyenesen
            használható.
          </p>
        )}
      </div>
    </div>
  );
}
