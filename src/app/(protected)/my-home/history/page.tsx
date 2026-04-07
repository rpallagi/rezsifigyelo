import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

export default async function TenantHistoryPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);

  // TODO: Get tenant's property and show readings history
  return (
    <div>
      <h1 className="text-2xl font-bold">{m.common.history}</h1>
      <p className="mt-4 text-muted-foreground">
        {m.tenantShell.historyPlaceholder}
      </p>
    </div>
  );
}
