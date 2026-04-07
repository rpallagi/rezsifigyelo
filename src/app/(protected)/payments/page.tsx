import { api } from "@/trpc/server";
import Link from "next/link";

export default async function AllPaymentsPage() {
  const properties = await api.property.list();

  const allPayments: {
    id: number;
    propertyName: string;
    propertyId: number;
    amountHuf: number;
    paymentDate: string;
    paymentMethod: string | null;
    notes: string | null;
  }[] = [];

  for (const prop of properties) {
    const payments = await api.payment.list({ propertyId: prop.id });
    for (const p of payments) {
      allPayments.push({
        id: p.id,
        propertyName: prop.name,
        propertyId: prop.id,
        amountHuf: p.amountHuf,
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
      });
    }
  }

  allPayments.sort(
    (a, b) =>
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
  );

  const totalAmount = allPayments.reduce((acc, p) => acc + p.amountHuf, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Összes befizetés</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {allPayments.length} befizetés — összesen{" "}
        {totalAmount.toLocaleString("hu-HU")} Ft
      </p>

      {allPayments.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Még nincs befizetés.</p>
      ) : (
        <div className="mt-6 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">Dátum</th>
                <th className="pb-3 font-medium">Ingatlan</th>
                <th className="pb-3 font-medium">Összeg</th>
                <th className="pb-3 font-medium">Mód</th>
                <th className="pb-3 font-medium">Megjegyzés</th>
              </tr>
            </thead>
            <tbody>
              {allPayments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{p.paymentDate}</td>
                  <td className="py-2">
                    <Link
                      href={`/properties/${p.propertyId}`}
                      className="hover:underline"
                    >
                      {p.propertyName}
                    </Link>
                  </td>
                  <td className="py-2 font-medium">
                    {p.amountHuf.toLocaleString("hu-HU")} Ft
                  </td>
                  <td className="py-2">{p.paymentMethod ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">
                    {p.notes ?? "—"}
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
