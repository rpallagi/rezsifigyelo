import { api } from "@/trpc/server";

export default async function TenantsPage() {
  const properties = await api.property.list();

  const allTenancies = properties.flatMap((p) =>
    p.tenancies.map((t) => ({ ...t, propertyName: p.name })),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Bérlők</h1>

      {allTenancies.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Még nincs bérlőd. Adj hozzá bérlőt egy ingatlanhoz.
        </p>
      ) : (
        <div className="mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">Név</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Ingatlan</th>
                <th className="pb-3 font-medium">Státusz</th>
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
                      {t.active ? "Aktív" : "Inaktív"}
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
