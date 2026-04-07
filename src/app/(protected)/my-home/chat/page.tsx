import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

export default async function TenantChatPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);

  // TODO: Get tenant's property and show chat
  return (
    <div>
      <h1 className="text-2xl font-bold">{m.common.messages}</h1>
      <p className="mt-4 text-muted-foreground">
        {m.tenantShell.chatPlaceholder}
      </p>
    </div>
  );
}
