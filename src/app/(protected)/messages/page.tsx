import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

export default async function MessagesPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);

  return (
    <div>
      <h1 className="text-2xl font-bold">{m.messagesPage.title}</h1>
      <p className="mt-4 text-muted-foreground">
        {m.messagesPage.description}
      </p>
    </div>
  );
}
