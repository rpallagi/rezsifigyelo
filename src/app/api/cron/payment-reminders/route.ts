import { type NextRequest } from "next/server";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/server/db";
import { chatMessages, invoices, properties, tenancies } from "@/server/db/schema";
import { sendEmail } from "@/server/email/send";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReminderResult = {
  invoiceId: number;
  invoiceNumber: string | null;
  propertyId: number;
  status: "reminded" | "error";
  emailSent: boolean;
  reason?: string;
};

// ---------------------------------------------------------------------------
// GET handler — called by Vercel Cron
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const todayIso = now.toISOString().split("T")[0]!;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  console.log(
    `[cron] payment-reminders started — ${now.toISOString()}`,
  );

  // Query overdue invoices:
  // - status = 'sent' (not draft, not paid)
  // - dueDate < today
  // - reminderSentAt is null OR reminderSentAt < 7 days ago
  const overdueInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "sent"),
        lt(invoices.dueDate, todayIso),
        or(
          isNull(invoices.reminderSentAt),
          lt(invoices.reminderSentAt, sevenDaysAgo),
        ),
      ),
    );

  console.log(
    `[cron] Found ${overdueInvoices.length} overdue invoices to remind`,
  );

  const results: ReminderResult[] = [];

  for (const invoice of overdueInvoices) {
    const result: ReminderResult = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      propertyId: invoice.propertyId,
      status: "reminded",
      emailSent: false,
    };

    try {
      // Find property and active tenancy
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, invoice.propertyId),
      });

      const activeTenancy = await db.query.tenancies.findFirst({
        where: and(
          eq(tenancies.propertyId, invoice.propertyId),
          eq(tenancies.active, true),
        ),
        with: { tenant: true },
      });

      const reminderMessage = `Fizetési emlékeztető: A(z) ${invoice.invoiceNumber ?? `#${invoice.id}`} számla (${Math.round(invoice.grossTotalHuf)} Ft) lejárt ${invoice.dueDate}-n. Kérjük mielőbb rendezze.`;

      // Send chat message
      await db.insert(chatMessages).values({
        propertyId: invoice.propertyId,
        senderId: invoice.landlordId,
        senderType: "admin",
        message: reminderMessage,
      });

      // Send email if tenant has email
      const tenantEmail =
        activeTenancy?.tenant?.email ?? activeTenancy?.tenantEmail ?? null;

      if (tenantEmail) {
        const propertyName = property?.name ?? "Ingatlan";
        const emailResult = await sendEmail({
          to: tenantEmail,
          subject: `Fizetési emlékeztető — ${invoice.invoiceNumber ?? `#${invoice.id}`}`,
          html: `
            <h2>Fizetési emlékeztető</h2>
            <p>Tisztelt Bérlő!</p>
            <p>A(z) <strong>${propertyName}</strong> ingatlanhoz tartozó
            <strong>${invoice.invoiceNumber ?? `#${invoice.id}`}</strong> számla
            (<strong>${Math.round(invoice.grossTotalHuf)} Ft</strong>) lejárt
            <strong>${invoice.dueDate}</strong>-n.</p>
            <p>Kérjük, mielőbb rendezze a tartozást.</p>
            <p>Üdvözlettel,<br/>Rezsi Figyelő</p>
          `,
        });

        result.emailSent = emailResult.success;
      }

      // Update reminderSentAt and status
      await db
        .update(invoices)
        .set({
          reminderSentAt: now,
          status: "overdue",
        })
        .where(eq(invoices.id, invoice.id));

      results.push(result);
    } catch (error) {
      result.status = "error";
      result.reason =
        error instanceof Error ? error.message : "Ismeretlen hiba";
      results.push(result);
      console.error(
        `[cron] Error processing invoice ${invoice.id}:`,
        error,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Lease expiration reminders (2 weeks before leaseEndDate)
  // -----------------------------------------------------------------------

  const twoWeeksFromNow = new Date(now);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  const twoWeeksStr = twoWeeksFromNow.toISOString().split("T")[0]!;
  const expiringTenancies = await db.query.tenancies.findMany({
    where: and(
      eq(tenancies.active, true),
      eq(tenancies.leaseRenewalNotified, false),
      lt(tenancies.leaseEndDate, twoWeeksStr),
    ),
    with: { property: true },
  });

  let leaseReminders = 0;
  for (const tenancy of expiringTenancies) {
    if (!tenancy.leaseEndDate || !tenancy.property) continue;

    const msg = `Szerződés lejárat figyelmeztetés: A(z) ${tenancy.property.name} ingatlan bérleti szerződése ${tenancy.leaseEndDate}-n lejár. Kérjük egyeztessen a hosszabbításról vagy a kiköltözésről.`;

    await db.insert(chatMessages).values({
      propertyId: tenancy.propertyId,
      senderId: tenancy.property.landlordId,
      senderType: "admin",
      message: msg,
    });

    const tenantEmail = tenancy.tenantEmail;
    if (tenantEmail) {
      await sendEmail({
        to: tenantEmail,
        subject: `Szerződés lejárat — ${tenancy.property.name}`,
        html: `<p>${msg}</p>`,
      });
    }

    await db
      .update(tenancies)
      .set({ leaseRenewalNotified: true })
      .where(eq(tenancies.id, tenancy.id));

    leaseReminders++;
  }

  const summary = {
    timestamp: now.toISOString(),
    totalOverdue: overdueInvoices.length,
    reminded: results.filter((r) => r.status === "reminded").length,
    emailsSent: results.filter((r) => r.emailSent).length,
    errors: results.filter((r) => r.status === "error").length,
    leaseReminders,
    results,
  };

  console.log(
    `[cron] payment-reminders done — reminded: ${summary.reminded}, emails: ${summary.emailsSent}, lease: ${leaseReminders}, errors: ${summary.errors}`,
  );

  return Response.json(summary);
}
