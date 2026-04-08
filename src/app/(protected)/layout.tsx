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
  const managementLinks = [
    { href: "/dashboard", label: m.common.dashboard },
    { href: "/properties", label: m.common.properties },
    { href: "/readings", label: m.common.readings },
    { href: "/payments", label: m.common.payments },
    { href: "/tenants", label: m.common.tenants },
    { href: "/todos", label: m.common.todos },
    { href: "/messages", label: m.common.messages },
  ];
  const analyticsLinks = [
    { href: "/tariffs", label: m.common.tariffs },
    { href: "/roi", label: "ROI" },
    { href: "/billing", label: m.common.billing },
    { href: "/settings", label: m.common.settings },
  ];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar p-4 lg:flex lg:flex-col">
        <div className="mb-6">
          <Link href="/dashboard" className="text-xl font-bold">
            {m.common.appName}
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          <span className="mb-1 mt-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {m.common.management}
          </span>
          {managementLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 hover:bg-sidebar-accent"
            >
              {link.label}
            </Link>
          ))}

          <span className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {m.common.analytics}
          </span>
          {analyticsLinks.slice(0, 2).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 hover:bg-sidebar-accent"
            >
              {link.label}
            </Link>
          ))}

          <div className="my-3 border-t border-border" />

          {analyticsLinks.slice(2).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 hover:bg-sidebar-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-6">
          <UserButton />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="text-base font-semibold">
              {m.common.appName}
            </Link>
            <UserButton />
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 text-sm">
            {[...managementLinks, ...analyticsLinks].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-full border border-border px-3 py-2 hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
