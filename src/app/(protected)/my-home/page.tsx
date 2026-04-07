import { api } from "@/trpc/server";
import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TenantHomePage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const user = await api.user.me();

  if (user.role !== "tenant") {
    redirect("/dashboard");
  }

  // TODO: Find active tenancy for this user and show their property
  return (
    <div>
      <h1 className="text-2xl font-bold">
        {m.dashboardPage.greeting}, {user.firstName ?? user.email}!
      </h1>
      <p className="mt-2 text-muted-foreground">
        {m.tenantShell.welcome}
      </p>

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
    </div>
  );
}
