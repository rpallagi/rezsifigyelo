import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { PropertyChatThread } from "@/components/chat/property-chat-thread";

export default async function TenantChatPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const activeTenancy = await api.tenancy.myActive();

  if (!activeTenancy) {
    redirect("/my-home");
  }

  return (
    <PropertyChatThread
      propertyId={activeTenancy.propertyId}
      title={`${m.common.messages} - ${activeTenancy.property.name}`}
      emptyMessage={m.tenantShell.chatPlaceholder}
    />
  );
}
