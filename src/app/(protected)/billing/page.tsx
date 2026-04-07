import { api } from "@/trpc/server";
import { formatDate, getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

export default async function BillingPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const subscription = await api.subscription.current();

  return (
    <div>
      <h1 className="text-2xl font-bold">{m.billingPage.title}</h1>

      <div className="mt-6 rounded-lg border border-border p-6">
        <h3 className="font-semibold">{m.billingPage.subscription}</h3>
        {subscription ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              {m.common.status}:{" "}
              <span className="font-medium capitalize">
                {subscription.status}
              </span>
            </p>
            {subscription.currentPeriodEnd && (
              <p>
                {m.billingPage.nextBilling}:{" "}
                {formatDate(subscription.currentPeriodEnd, locale)}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {m.billingPage.noSubscription}
          </p>
        )}
      </div>
    </div>
  );
}
