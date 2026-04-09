import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { invoices } from "@/server/db/schema";

/**
 * Számlázz.hu IPN (Instant Payment Notification) webhook.
 *
 * Számlázz.hu sends a POST request when an invoice is paid.
 * The body is URL-encoded with fields like:
 *   szamlaszam (invoice number), fizpiId, osszeg (amount), stb.
 *
 * Docs: https://docs.szamlazz.hu/#ipn-instant-payment-notification
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  const invoiceNumber = params.get("szamlaszam");
  const amountStr = params.get("osszeg");

  if (!invoiceNumber) {
    return NextResponse.json({ error: "Missing szamlaszam" }, { status: 400 });
  }

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.invoiceNumber, invoiceNumber),
  });

  if (!invoice) {
    // Not our invoice — acknowledge anyway so Számlázz.hu stops retrying
    return NextResponse.json({ ok: true, matched: false });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ ok: true, already: true });
  }

  const paidAmount = amountStr ? parseFloat(amountStr) : invoice.grossTotalHuf;

  await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      paidAmount,
      paidMethod: "szamlazz_ipn",
    })
    .where(eq(invoices.id, invoice.id));

  console.log(`[Számlázz.hu IPN] Invoice ${invoiceNumber} marked as paid (${paidAmount} Ft)`);

  return NextResponse.json({ ok: true, invoiceId: invoice.id });
}
