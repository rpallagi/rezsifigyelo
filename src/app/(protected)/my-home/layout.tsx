import { redirect } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/server";
import { getCurrentLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await api.user.me();
  const locale = await getCurrentLocale();
  const m = getMessages(locale);

  if (user.role !== "tenant") {
    redirect("/dashboard");
  }

  return (
    <div>
      {/* Tenant sub-navigation */}
      <nav className="mb-6 flex gap-2 border-b border-border pb-3">
        <Link
          href="/my-home"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          {m.common.overview}
        </Link>
        <Link
          href="/my-home/readings"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          {m.tenantShell.recordReading}
        </Link>
        <Link
          href="/my-home/history"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          {m.common.history}
        </Link>
        <Link
          href="/my-home/chat"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          {m.common.messages}
        </Link>
      </nav>
      {children}
    </div>
  );
}
