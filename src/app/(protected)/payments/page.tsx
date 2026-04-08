import { api } from "@/trpc/server";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getMessages,
} from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import Link from "next/link";

export default async function AllPaymentsPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const allPayments = await api.payment.listAll();

  const totalAmount = allPayments.reduce((acc, p) => acc + p.amountHuf, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">{m.paymentsPage.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatNumber(allPayments.length, locale)} {m.common.payments.toLowerCase()} — {m.paymentsPage.totalPrefix}{" "}
        {formatCurrency(totalAmount, locale)}
      </p>

      {allPayments.length === 0 ? (
        <p className="mt-8 text-muted-foreground">{m.paymentsPage.empty}</p>
      ) : (
        <div className="mt-6 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 font-medium">{m.common.date}</th>
                <th className="pb-3 font-medium">{m.common.property}</th>
                <th className="pb-3 font-medium">{m.common.amount}</th>
                <th className="pb-3 font-medium">{m.common.method}</th>
                <th className="pb-3 font-medium">{m.common.notes}</th>
              </tr>
            </thead>
            <tbody>
              {allPayments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{formatDate(p.paymentDate, locale)}</td>
                  <td className="py-2">
                    <Link
                      href={`/properties/${p.propertyId}`}
                      className="hover:underline"
                    >
                      {p.propertyName}
                    </Link>
                  </td>
                  <td className="py-2 font-medium">
                    {formatCurrency(p.amountHuf, locale)}
                  </td>
                  <td className="py-2">{p.paymentMethod ?? m.common.none}</td>
                  <td className="py-2 text-muted-foreground">
                    {p.notes ?? m.common.none}
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
