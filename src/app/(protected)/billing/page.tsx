import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);

  return (
    <div>
      <h1 className="text-2xl font-bold">{m.billingPage.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {m.billingPage.subtitle}
      </p>

      <div className="mt-6">
        <BillingClient />
      </div>
    </div>
  );
}
