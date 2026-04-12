import { api } from "@/trpc/server";
import Link from "next/link";
import { TariffRowActions, GroupDeleteButton } from "./tariff-actions";

export default async function TariffsPage() {
  const groups = await api.tariff.listGroups();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tarifák</h1>
        <Link
          href="/tariffs/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Új csoport
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Még nincs tarifa csoportod. Hozd létre az elsőt az ingatlanok
          díjszabásának kezeléséhez.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{group.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tariffs/${group.id}/edit`}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-secondary"
                  >
                    Szerkesztés
                  </Link>
                  <Link
                    href={`/tariffs/${group.id}/new-tariff`}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-secondary"
                  >
                    + Tarifa
                  </Link>
                  <GroupDeleteButton groupId={group.id} name={group.name} />
                </div>
              </div>
              {group.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {group.description}
                </p>
              )}
              {group.tariffs.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nincs tarifa ebben a csoportban.
                </p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Közmű</th>
                      <th className="pb-2 font-medium">Díj</th>
                      <th className="pb-2 font-medium">Egység</th>
                      <th className="pb-2 font-medium">Érvényes</th>
                      <th className="pb-2 font-medium">Műveletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.tariffs.map((t) => (
                      <TariffRowActions key={t.id} tariff={t} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
