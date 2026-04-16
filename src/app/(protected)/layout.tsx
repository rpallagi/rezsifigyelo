import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";
import { ProtectedNavigation } from "@/components/layout/protected-navigation";
import { api, HydrateClient } from "@/trpc/server";
import {
  LANDLORD_PROFILE_SCOPE_COOKIE,
  normalizeLandlordProfileScope,
  parseLandlordProfileScopeValue,
} from "@/lib/landlord-profile-scope";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Role-based gate: tenants can only access /my-home
  const me = await api.user.me();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  if (me.role === "tenant" && !pathname.startsWith("/my-home")) {
    redirect("/my-home");
  }

  // Tenants get a minimal layout (no landlord nav)
  if (me.role === "tenant") {
    return (
      <HydrateClient>
        <main className="min-h-screen bg-background">{children}</main>
      </HydrateClient>
    );
  }

  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const cookieStore = await cookies();
  const landlordProfiles = await api.landlordProfile.list();
  const normalizedScope = normalizeLandlordProfileScope(
    parseLandlordProfileScopeValue(
      cookieStore.get(LANDLORD_PROFILE_SCOPE_COOKIE)?.value,
    ),
    landlordProfiles.map((profile) => profile.id),
  );
  const managementLinks = [
    {
      href: "/dashboard",
      label: m.common.dashboard,
      icon: "dashboard",
      description: locale === "hu" ? "Portfólió egészség" : "Portfolio health",
    },
    {
      href: "/properties",
      label: m.common.properties,
      icon: "properties",
      description: locale === "hu" ? "Ingatlanok és egységek" : "Properties and units",
    },
    {
      href: "/readings",
      label: m.common.readings,
      icon: "readings",
      description: locale === "hu" ? "Leolvasások és trendek" : "Readings and trends",
    },
    {
      href: "/maintenance",
      label: locale === "hu" ? "Karbantartás" : "Maintenance",
      icon: "maintenance",
      description: locale === "hu" ? "Szerviz és javítások" : "Service and repairs",
    },
    {
      href: "/tenants",
      label: m.common.tenants,
      icon: "tenants",
      description: locale === "hu" ? "Bérlők és meghívók" : "Tenants and invites",
    },
    {
      href: "/todos",
      label: m.common.todos,
      icon: "todos",
      description: locale === "hu" ? "Nyitott feladatok" : "Open tasks",
    },
    {
      href: "/messages",
      label: m.common.messages,
      icon: "messages",
      description: locale === "hu" ? "Kommunikáció" : "Communication",
    },
  ];
  const analyticsLinks = [
    {
      href: "/tariffs",
      label: m.common.tariffs,
      icon: "tariffs",
      description: locale === "hu" ? "Tarifák és díjak" : "Tariffs and fees",
    },
    {
      href: "/roi",
      label: "ROI",
      icon: "roi",
      description: locale === "hu" ? "Befektetési analitika" : "Investment analytics",
    },
    {
      href: "/billing",
      label: m.common.billing,
      icon: "billing",
      description: locale === "hu" ? "Számlázás és vevő" : "Invoices and buyers",
    },
    {
      href: "/settings",
      label: m.common.settings,
      icon: "settings",
      description: locale === "hu" ? "Integrációk és profilok" : "Integrations and profiles",
    },
  ];
  const sections = [
    { title: m.common.management, items: managementLinks },
    { title: m.common.analytics, items: analyticsLinks },
  ];

  return (
    <HydrateClient>
      <div className="min-h-screen lg:flex">
        <ProtectedNavigation
          appName={m.common.appName}
          sections={sections}
          createPropertyLabel={m.dashboardPage.createProperty}
          landlordProfiles={landlordProfiles.map((profile) => ({
            id: profile.id,
            displayName: profile.displayName,
            profileType: profile.profileType,
            color: profile.color,
            isDefault: profile.isDefault,
            propertyCount: profile.propertyCount,
          }))}
          activeLandlordProfileIds={normalizedScope}
        />

        <div className="flex min-h-screen flex-1 flex-col">
          <main className="flex-1 overflow-auto p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8">
            {children}
          </main>
        </div>
      </div>
    </HydrateClient>
  );
}
