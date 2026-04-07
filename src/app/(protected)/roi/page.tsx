import { api } from "@/trpc/server";

export default async function ROIPage() {
  const properties = await api.property.list();

  const propertiesWithROI = properties
    .filter((p) => p.purchasePrice && p.purchasePrice > 0)
    .map((p) => {
      const annualRent = (p.monthlyRent ?? 0) * 12;
      const roiPercent =
        p.purchasePrice && p.purchasePrice > 0
          ? ((annualRent / p.purchasePrice) * 100).toFixed(1)
          : "—";
      const breakEvenYears =
        annualRent > 0 && p.purchasePrice
          ? (p.purchasePrice / annualRent).toFixed(1)
          : "—";

      return {
        ...p,
        annualRent,
        roiPercent,
        breakEvenYears,
      };
    });

  const totalPurchase = propertiesWithROI.reduce(
    (acc, p) => acc + (p.purchasePrice ?? 0),
    0,
  );
  const totalAnnualRent = propertiesWithROI.reduce(
    (acc, p) => acc + p.annualRent,
    0,
  );
  const avgROI =
    totalPurchase > 0
      ? ((totalAnnualRent / totalPurchase) * 100).toFixed(1)
      : "—";

  return (
    <div>
      <h1 className="text-2xl font-bold">ROI Áttekintés</h1>

      {/* Summary */}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">Össz. befektetés</h3>
          <p className="mt-2 text-2xl font-bold">
            {totalPurchase.toLocaleString("hu-HU")} Ft
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">Éves bevétel</h3>
          <p className="mt-2 text-2xl font-bold">
            {totalAnnualRent.toLocaleString("hu-HU")} Ft
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">Átlag ROI</h3>
          <p className="mt-2 text-2xl font-bold">{avgROI}%</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">Ingatlanok</h3>
          <p className="mt-2 text-2xl font-bold">{propertiesWithROI.length}</p>
        </div>
      </div>

      {/* Per-property ROI */}
      {propertiesWithROI.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Adj meg vételárat és havi bérleti díjat az ingatlanokhoz a ROI
          számításhoz.
        </p>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 font-medium">Ingatlan</th>
              <th className="pb-3 font-medium">Vételár</th>
              <th className="pb-3 font-medium">Havi bérleti díj</th>
              <th className="pb-3 font-medium">Éves bevétel</th>
              <th className="pb-3 font-medium">ROI</th>
              <th className="pb-3 font-medium">Megtérülés</th>
            </tr>
          </thead>
          <tbody>
            {propertiesWithROI.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-3 font-medium">{p.name}</td>
                <td className="py-3">
                  {(p.purchasePrice ?? 0).toLocaleString("hu-HU")} Ft
                </td>
                <td className="py-3">
                  {(p.monthlyRent ?? 0).toLocaleString("hu-HU")} Ft
                </td>
                <td className="py-3">
                  {p.annualRent.toLocaleString("hu-HU")} Ft
                </td>
                <td className="py-3 font-semibold">{p.roiPercent}%</td>
                <td className="py-3">{p.breakEvenYears} év</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
