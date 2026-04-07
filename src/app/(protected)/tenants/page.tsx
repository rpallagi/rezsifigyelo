import { api } from "@/trpc/server";
import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

export default async function TenantsPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const properties = await api.property.list();

  const allTenancies = properties.flatMap((p) =>
    p.tenancies.map((t) => ({ ...t, propertyName: p.name })),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">{m.tenantsPage.title}</h1>

      {allTenancies.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {m.tenantsPage.empty}
        </p>
      ) : (
        <div className="mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">{m.common.name}</th>
                <th className="pb-3 font-medium">{m.common.email}</th>
                <th className="pb-3 font-medium">{m.tenantsPage.property}</th>
                <th className="pb-3 font-medium">{m.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {allTenancies.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="py-3">
                    {t.tenant.firstName} {t.tenant.lastName}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {t.tenant.email}
                  </td>
                  <td className="py-3">{t.propertyName}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        t.active
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {t.active ? m.common.active : m.common.inactive}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
