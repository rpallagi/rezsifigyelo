"use client";

import {
  BarChart3,
  Building2,
  Filter,
  Gauge,
  Home,
  MessageSquare,
  Moon,
  Receipt,
  Settings,
  SlidersHorizontal,
  SquareCheckBig,
  Sun,
  Users,
  Wrench,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  LANDLORD_PROFILE_SCOPE_COOKIE,
  normalizeLandlordProfileScope,
  serializeLandlordProfileScope,
} from "@/lib/landlord-profile-scope";
import { api } from "@/trpc/react";

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
  landlordProfiles: {
    id: number;
    displayName: string;
    profileType: "individual" | "company" | "co_ownership";
    color: string | null;
    isDefault: boolean;
    propertyCount: number;
  }[];
  activeLandlordProfileIds: number[] | null;
};

const iconMap: Record<string, LucideIcon> = {
  dashboard: Home,
  properties: Building2,
  readings: Gauge,
  maintenance: Wrench,
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

function profileTypeLabel(profileType: "individual" | "company" | "co_ownership") {
  switch (profileType) {
    case "company":
      return "Cég";
    case "co_ownership":
      return "Társasház";
    default:
      return "Magán";
  }
}

function profileCountLabel(count: number) {
  return `${count} ingatlan`;
}

function profileBadgeColor(color: string | null) {
  const map: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    purple:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
    sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-300",
  };

  return map[color ?? ""] ?? map.slate;
}

function profileDotColor(color: string | null) {
  const map: Record<string, string> = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    purple: "bg-purple-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
    orange: "bg-orange-500",
    slate: "bg-slate-500",
  };

  return map[color ?? ""] ?? map.slate;
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  function cycle() {
    if (theme === "system") {
      setTheme(isDark ? "light" : "dark");
    } else if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={isDark ? "Világos mód" : "Sötét mód"}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function ProtectedNavigation({
  appName,
  sections,
  createPropertyLabel: _createPropertyLabel,
  landlordProfiles,
  activeLandlordProfileIds,
}: ProtectedNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const utils = api.useUtils();
  const [isPending, startTransition] = useTransition();
  const allProfileIds = landlordProfiles.map((profile) => profile.id);
  const normalizedScope = normalizeLandlordProfileScope(
    activeLandlordProfileIds,
    allProfileIds,
  );
  const activeProfileIds = normalizedScope ?? allProfileIds;
  const allProfilesActive = normalizedScope === null;
  const activeProfileCount = activeProfileIds.length;

  function updateScope(nextProfileIds: number[] | null) {
    const normalizedNext = normalizeLandlordProfileScope(nextProfileIds, allProfileIds);

    document.cookie = `${LANDLORD_PROFILE_SCOPE_COOKIE}=${serializeLandlordProfileScope(normalizedNext)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => {
      void utils.invalidate();
      router.refresh();
    });
  }

  function toggleProfile(profileId: number) {
    if (allProfilesActive) {
      updateScope([profileId]);
      return;
    }

    const selectedIds = new Set(activeProfileIds);
    if (selectedIds.has(profileId)) {
      selectedIds.delete(profileId);
    } else {
      selectedIds.add(profileId);
    }

    updateScope(selectedIds.size > 0 ? [...selectedIds] : null);
  }

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-sidebar px-4 py-5 lg:flex lg:flex-col">
        <div className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60">
          <Link href="/dashboard" className="block">
            <p className="text-xl font-semibold tracking-tight">{appName}</p>
            <p className="mt-1 text-sm text-muted-foreground">Ingatlankezelés</p>
          </Link>

          <div className="mt-5 rounded-[24px] border border-border/60 bg-background/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Profil szűrő</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {allProfilesActive
                    ? "Minden szamlázói profil aktív."
                    : `${activeProfileCount} profil aktív a globális scope-ban.`}
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Filter className="h-4 w-4" strokeWidth={2.1} />
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => updateScope(null)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  allProfilesActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-card text-foreground hover:bg-secondary"
                }`}
              >
                <span className="text-xs font-semibold">Összes profil</span>
              </button>

              {landlordProfiles.map((profile) => {
                const selected = activeProfileIds.includes(profile.id);

                return (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleProfile(profile.id)}
                    className={`inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? profileBadgeColor(profile.color)
                        : "border-border/70 bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${profileDotColor(profile.color)}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {profile.displayName}
                      </span>
                      <span className="block truncate text-[10px] uppercase tracking-[0.14em] opacity-70">
                        {profileTypeLabel(profile.profileType)} · {profileCountLabel(profile.propertyCount)}
                        {profile.isDefault ? " · alap" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

          </div>
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
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LazyUserButton />
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight">
            {appName}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LazyUserButton />
          </div>
        </div>
        {landlordProfiles.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateScope(null)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                allProfilesActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-card text-foreground"
              }`}
            >
              Összes
            </button>
            {landlordProfiles.map((profile) => {
              const selected = activeProfileIds.includes(profile.id);

              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => toggleProfile(profile.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? profileBadgeColor(profile.color)
                      : "border-border/70 bg-card text-foreground"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${profileDotColor(profile.color)}`}
                  />
                  {profile.displayName}
                </button>
              );
            })}
          </div>
        )}
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
