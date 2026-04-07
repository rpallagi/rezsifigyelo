import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { getCurrentLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-border bg-sidebar p-4">
        <div className="mb-6">
          <Link href="/dashboard" className="text-xl font-bold">
            {m.common.appName}
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          <span className="mb-1 mt-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {m.common.management}
          </span>
          <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.dashboard}
          </Link>
          <Link href="/properties" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.properties}
          </Link>
          <Link href="/readings" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.readings}
          </Link>
          <Link href="/payments" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.payments}
          </Link>
          <Link href="/tenants" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.tenants}
          </Link>
          <Link href="/todos" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.todos}
          </Link>
          <Link href="/messages" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.messages}
          </Link>

          <span className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {m.common.analytics}
          </span>
          <Link href="/tariffs" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.tariffs}
          </Link>
          <Link href="/roi" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            ROI
          </Link>

          <div className="my-3 border-t border-border" />

          <Link href="/billing" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.billing}
          </Link>
          <Link href="/settings" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            {m.common.settings}
          </Link>
        </nav>
        <div className="mt-auto pt-6">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
