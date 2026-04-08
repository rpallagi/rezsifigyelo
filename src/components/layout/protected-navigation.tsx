"use client";

import {
  BarChart3,
  Building2,
  CreditCard,
  Gauge,
  Home,
  MessageSquare,
  Receipt,
  Settings,
  SlidersHorizontal,
  SquareCheckBig,
  Users,
  Waves,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  description?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type ProtectedNavigationProps = {
  appName: string;
  sections: NavSection[];
  createPropertyLabel: string;
};

const iconMap: Record<string, LucideIcon> = {
  dashboard: Home,
  properties: Building2,
  readings: Gauge,
  payments: CreditCard,
  tenants: Users,
  todos: SquareCheckBig,
  messages: MessageSquare,
  tariffs: SlidersHorizontal,
  roi: BarChart3,
  billing: Receipt,
  settings: Settings,
};

const LazyUserButton = dynamic(
  () => import("./user-button-shell").then((mod) => mod.UserButtonShell),
  {
    ssr: false,
    loading: () => <div className="h-8 w-8 rounded-full bg-muted" />,
  },
);

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ProtectedNavigation({
  appName,
  sections,
  createPropertyLabel,
}: ProtectedNavigationProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(247,249,251,0.98))] px-4 py-5 lg:flex lg:flex-col">
        <div className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60">
          <Link href="/dashboard" className="block">
            <p className="text-xl font-semibold tracking-tight">{appName}</p>
            <p className="mt-1 text-sm text-muted-foreground">Admin Analytics</p>
          </Link>

          <Link
            href="/properties/new"
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            {createPropertyLabel}
          </Link>
        </div>

        <nav className="mt-6 flex-1 space-y-6 overflow-y-auto pb-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {section.title}
              </p>
              <div className="mt-3 space-y-1.5">
                {section.items.map((item) => {
                  const Icon = iconMap[item.icon] ?? Home;
                  const active = isActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                        active
                          ? "bg-card text-primary shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary/70 text-muted-foreground group-hover:bg-secondary"
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        {item.description && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto rounded-[24px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Profil</p>
              <p className="mt-1 text-xs text-muted-foreground">Clerk account</p>
            </div>
            <LazyUserButton />
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight">
            {appName}
          </Link>
          <LazyUserButton />
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          {sections.flatMap((section) => section.items).map((item) => {
            const Icon = iconMap[item.icon] ?? Home;
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-border/60 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.1} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-2">
          {sections
            .flatMap((section) => section.items)
            .filter((item) =>
              ["/dashboard", "/properties", "/roi", "/settings"].includes(item.href),
            )
            .map((item) => {
              const Icon = iconMap[item.icon] ?? Home;
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] transition ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.1} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
        </div>
      </nav>
    </>
  );
}
