import { api } from "@/trpc/server";
import Link from "next/link";

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Víz",
  gaz: "Gáz",
  csatorna: "Csatorna",
  internet: "Internet",
  kozos_koltseg: "Közös költség",
  egyeb: "Egyéb",
};

export default async function AllReadingsPage() {
  const allReadings = await api.reading.listAll();

  return (
    <div>
      <h1 className="text-2xl font-bold">Összes leolvasás</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {allReadings.length} leolvasás az összes ingatlanból
      </p>

      {allReadings.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Még nincs leolvasás.</p>
      ) : (
        <div className="mt-6 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">Dátum</th>
                <th className="pb-3 font-medium">Ingatlan</th>
                <th className="pb-3 font-medium">Közmű</th>
                <th className="pb-3 font-medium">Állás</th>
                <th className="pb-3 font-medium">Fogyasztás</th>
                <th className="pb-3 font-medium">Költség</th>
                <th className="pb-3 font-medium">Forrás</th>
              </tr>
            </thead>
            <tbody>
              {allReadings.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.readingDate}</td>
                  <td className="py-2">
                    <Link
                      href={`/properties/${r.propertyId}`}
                      className="hover:underline"
                    >
                      {r.propertyName}
                    </Link>
                  </td>
                  <td className="py-2">
                    {utilityLabels[r.utilityType] ?? r.utilityType}
                  </td>
                  <td className="py-2 font-mono">{r.value}</td>
                  <td className="py-2">
                    {r.consumption != null ? r.consumption.toFixed(2) : "—"}
                  </td>
                  <td className="py-2">
                    {r.costHuf != null
                      ? `${r.costHuf.toLocaleString("hu-HU")} Ft`
                      : "—"}
                  </td>
                  <td className="py-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {r.source}
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
