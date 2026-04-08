import { getCurrentLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";
import { ProtectedNavigation } from "@/components/layout/protected-navigation";
import { api, HydrateClient } from "@/trpc/server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  void api.user.me.prefetch();
  void api.property.list.prefetch();
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
      href: "/payments",
      label: m.common.payments,
      icon: "payments",
      description: locale === "hu" ? "Bejövő pénzmozgás" : "Incoming payments",
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
