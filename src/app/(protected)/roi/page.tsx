import { api } from "@/trpc/server";
import {
  formatCurrency,
  formatNumber,
  getMessages,
} from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";

export default async function ROIPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
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
      <h1 className="text-2xl font-bold">{m.roiPage.title}</h1>

      {/* Summary */}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">{m.roiPage.totalInvestment}</h3>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(totalPurchase, locale)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">{m.roiPage.annualRevenue}</h3>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(totalAnnualRent, locale)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">{m.roiPage.averageRoi}</h3>
          <p className="mt-2 text-2xl font-bold">{avgROI}%</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm text-muted-foreground">{m.roiPage.properties}</h3>
          <p className="mt-2 text-2xl font-bold">{formatNumber(propertiesWithROI.length, locale)}</p>
        </div>
      </div>

      {/* Per-property ROI */}
      {propertiesWithROI.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {m.roiPage.empty}
        </p>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 font-medium">{m.common.property}</th>
              <th className="pb-3 font-medium">{m.roiPage.purchasePrice}</th>
              <th className="pb-3 font-medium">{m.roiPage.monthlyRent}</th>
              <th className="pb-3 font-medium">{m.roiPage.annualRevenue}</th>
              <th className="pb-3 font-medium">ROI</th>
              <th className="pb-3 font-medium">{m.roiPage.breakEven}</th>
            </tr>
          </thead>
          <tbody>
            {propertiesWithROI.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-3 font-medium">{p.name}</td>
                <td className="py-3">
                  {formatCurrency(p.purchasePrice ?? 0, locale)}
                </td>
                <td className="py-3">
                  {formatCurrency(p.monthlyRent ?? 0, locale)}
                </td>
                <td className="py-3">
                  {formatCurrency(p.annualRent, locale)}
                </td>
                <td className="py-3 font-semibold">{p.roiPercent}%</td>
                <td className="py-3">{p.breakEvenYears} {m.common.yearsSuffix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
