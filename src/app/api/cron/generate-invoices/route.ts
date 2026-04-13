import { type NextRequest } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/server/db";
import {
  commonFees,
  invoiceItems,
  invoices,
  type landlordProfiles,
  meterReadings,
  properties,
  tenancies,
} from "@/server/db/schema";
import type { users } from "@/server/db/schema";
import { createInvoiceWithSzamlazz } from "@/server/billing/szamlazz";

// ---------------------------------------------------------------------------
// Helpers (mirrored from invoice.ts to avoid tRPC context dependency)
// ---------------------------------------------------------------------------

const _HUNGARIAN_MONTHS = [
  "januar",
  "februar",
  "marcius",
  "aprilis",
  "majus",
  "junius",
  "julius",
  "augusztus",
  "szeptember",
  "oktober",
  "november",
  "december",
] as const;

const HUNGARIAN_MONTHS_DISPLAY = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
] as const;

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function parseVatRate(vatCode: string) {
  const normalized = vatCode.trim().toUpperCase();
  if (normalized === "TAM" || normalized === "AAM") {
    return { code: normalized, percentage: 0 };
  }
  const percentage = Number(normalized);
  if (Number.isFinite(percentage) && percentage >= 0) {
    return { code: normalized, percentage };
  }
  return { code: "TAM", percentage: 0 };
}

function applyVat(amountHuf: number, vatCode: string) {
  const vat = parseVatRate(vatCode);
  const netAmountHuf = roundAmount(amountHuf);
  const vatAmountHuf = roundAmount(netAmountHuf * (vat.percentage / 100));
  return {
    vatCode: vat.code,
    netAmountHuf,
    vatAmountHuf,
    grossAmountHuf: roundAmount(netAmountHuf + vatAmountHuf),
  };
}

function computeDefaultDueDate(issueDateIso: string, dueDay: number) {
  const issueDate = new Date(issueDateIso);
  const year = issueDate.getUTCFullYear();
  const month = issueDate.getUTCMonth();
  const normalizedDueDay = Math.min(Math.max(dueDay, 1), 31);
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const targetDay = Math.min(normalizedDueDay, lastDayOfMonth);
  return new Date(Date.UTC(year, month, targetDay)).toISOString().split("T")[0]!;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PropertyRow = typeof properties.$inferSelect & {
  commonFees: Array<typeof commonFees.$inferSelect>;
  tenancies: Array<
    typeof tenancies.$inferSelect & {
      tenant: typeof users.$inferSelect | null;
    }
  >;
  landlordProfile: typeof landlordProfiles.$inferSelect | null;
};

type ActiveTenancy =
  | (typeof tenancies.$inferSelect & {
      tenant: typeof users.$inferSelect | null;
    })
  | null;

type InvoiceItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceHuf: number;
  netAmountHuf: number;
  vatRate: string;
  vatAmountHuf: number;
  grossAmountHuf: number;
  utilityType?: typeof meterReadings.$inferSelect.utilityType;
  sourceType: string;
  sourceId?: number;
};

type PropertyResult = {
  propertyId: number;
  propertyName: string;
  status: "created" | "sent" | "skipped" | "error";
  reason?: string;
  invoiceId?: number;
  invoiceNumber?: string;
};

// ---------------------------------------------------------------------------
// Buyer resolution (same priority as invoice.ts)
// ---------------------------------------------------------------------------

function resolveBuyer(property: PropertyRow, activeTenancy: ActiveTenancy) {
  const billingName = property.billingName?.trim() ?? "";
  const billingEmail = property.billingEmail?.trim() ?? "";
  const billingAddress = property.billingAddress?.trim() ?? "";
  const billingTaxNumber = property.billingTaxNumber?.trim() ?? "";
  const tenantDisplayName =
    `${activeTenancy?.tenant?.firstName ?? ""} ${activeTenancy?.tenant?.lastName ?? ""}`.trim();
  const propertyContactName = property.contactName?.trim() ?? "";
  const propertyName = property.name.trim();
  const resolvedBillingAddress =
    billingAddress.length > 0 ? billingAddress : (property.address ?? null);

  if (billingName.length > 0) {
    return {
      name: billingName,
      email: billingEmail || null,
      address: resolvedBillingAddress,
      taxNumber: billingTaxNumber || null,
      buyerType: property.billingBuyerType,
    };
  }

  if (tenantDisplayName.length > 0) {
    return {
      name: tenantDisplayName,
      email: activeTenancy?.tenant?.email ?? null,
      address: property.address ?? null,
      taxNumber: null,
      buyerType: "individual" as const,
    };
  }

  if (activeTenancy?.tenant?.email) {
    return {
      name: activeTenancy.tenant.email,
      email: activeTenancy.tenant.email,
      address: property.address ?? null,
      taxNumber: null,
      buyerType: "individual" as const,
    };
  }

  if (propertyContactName.length > 0) {
    return {
      name: propertyContactName,
      email: property.contactEmail ?? null,
      address: resolvedBillingAddress,
      taxNumber: billingTaxNumber || null,
      buyerType: property.billingBuyerType,
    };
  }

  return {
    name: propertyName,
    email: property.contactEmail ?? null,
    address: resolvedBillingAddress,
    taxNumber: billingTaxNumber || null,
    buyerType: property.billingBuyerType,
  };
}

// ---------------------------------------------------------------------------
// Period computation
// ---------------------------------------------------------------------------

function computePeriod(billingMode: string, today: Date) {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth(); // 0-based

  if (billingMode === "advance") {
    // Current month
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 0)); // last day
    return {
      periodFrom: from.toISOString().split("T")[0]!,
      periodTo: to.toISOString().split("T")[0]!,
      monthIndex: month,
      monthYear: year,
    };
  }

  // arrears = previous month
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return {
    periodFrom: from.toISOString().split("T")[0]!,
    periodTo: to.toISOString().split("T")[0]!,
    monthIndex: from.getUTCMonth(),
    monthYear: from.getUTCFullYear(),
  };
}

// ---------------------------------------------------------------------------
// Build items for a single property
// ---------------------------------------------------------------------------

async function buildItemsForProperty(
  property: PropertyRow,
  periodFrom: string,
  periodTo: string,
  missingReadingsMode: string,
): Promise<{ items: InvoiceItem[]; warnings: string[] }> {
  const vatCode = property.billingVatCode?.trim() || "TAM";
  const items: InvoiceItem[] = [];
  const warnings: string[] = [];

  // 1. Rent
  if (property.monthlyRent && property.monthlyRent > 0) {
    const amounts = applyVat(property.monthlyRent, vatCode);
    items.push({
      description: `Bérleti díj (${periodFrom} - ${periodTo})`,
      quantity: 1,
      unit: "hó",
      unitPriceHuf: property.monthlyRent,
      netAmountHuf: amounts.netAmountHuf,
      vatRate: amounts.vatCode,
      vatAmountHuf: amounts.vatAmountHuf,
      grossAmountHuf: amounts.grossAmountHuf,
      sourceType: "rent",
    });
  }

  // 2. Common fees
  for (const fee of property.commonFees) {
    const amounts = applyVat(fee.monthlyAmount, vatCode);
    items.push({
      description: fee.recipient
        ? `Közös költség - ${fee.recipient}`
        : "Közös költség",
      quantity: 1,
      unit: fee.frequency === "quarterly" ? "negyedév" : "hó",
      unitPriceHuf: fee.monthlyAmount,
      netAmountHuf: amounts.netAmountHuf,
      vatRate: amounts.vatCode,
      vatAmountHuf: amounts.vatAmountHuf,
      grossAmountHuf: amounts.grossAmountHuf,
      sourceType: "common_fee",
      sourceId: fee.id,
    });
  }

  // 3. Meter readings
  const readings = await db.query.meterReadings.findMany({
    where: and(
      eq(meterReadings.propertyId, property.id),
      gte(meterReadings.readingDate, periodFrom),
      lte(meterReadings.readingDate, periodTo),
    ),
    orderBy: [desc(meterReadings.readingDate)],
  });

  if (readings.length === 0 && missingReadingsMode === "skip_readings") {
    // No readings, skip reading items silently
  } else if (readings.length === 0 && missingReadingsMode === "estimate") {
    // Use last known reading's consumption as estimate
    const lastReadings = await db.query.meterReadings.findMany({
      where: and(
        eq(meterReadings.propertyId, property.id),
      ),
      orderBy: [desc(meterReadings.readingDate)],
      limit: 20,
    });

    // Group by utility type, take the latest with a cost
    const lastByType = new Map<string, typeof lastReadings[number]>();
    for (const r of lastReadings) {
      if (r.costHuf != null && r.costHuf > 0 && !lastByType.has(r.utilityType)) {
        lastByType.set(r.utilityType, r);
      }
    }

    for (const [utilityType, reading] of lastByType) {
      if (reading.costHuf == null || reading.costHuf <= 0) continue;
      const amounts = applyVat(roundAmount(reading.costHuf), vatCode);
      items.push({
        description: `${utilityType} fogyasztás (${periodFrom} - ${periodTo}) [becsült]`,
        quantity: 1,
        unit: "időszak",
        unitPriceHuf: roundAmount(reading.costHuf),
        netAmountHuf: amounts.netAmountHuf,
        vatRate: amounts.vatCode,
        vatAmountHuf: amounts.vatAmountHuf,
        grossAmountHuf: amounts.grossAmountHuf,
        utilityType: utilityType as typeof meterReadings.$inferSelect.utilityType,
        sourceType: "reading_cost",
      });
      warnings.push(`${utilityType}: becsült fogyasztás az utolsó leolvasás alapján`);
    }
  } else {
    // Normal: group readings by utility type
    const groupedReadings = new Map<
      string,
      { grossAmountHuf: number; utilityType: string; count: number }
    >();

    for (const reading of readings) {
      if (reading.costHuf == null || reading.costHuf <= 0) continue;
      const key = reading.utilityType;
      const current = groupedReadings.get(key);
      if (current) {
        current.grossAmountHuf += reading.costHuf;
        current.count += 1;
      } else {
        groupedReadings.set(key, {
          grossAmountHuf: reading.costHuf,
          utilityType: reading.utilityType,
          count: 1,
        });
      }
    }

    for (const entry of groupedReadings.values()) {
      const amounts = applyVat(roundAmount(entry.grossAmountHuf), vatCode);
      items.push({
        description: `${entry.utilityType} fogyasztás (${periodFrom} - ${periodTo})`,
        quantity: 1,
        unit: "időszak",
        unitPriceHuf: roundAmount(entry.grossAmountHuf),
        netAmountHuf: amounts.netAmountHuf,
        vatRate: amounts.vatCode,
        vatAmountHuf: amounts.vatAmountHuf,
        grossAmountHuf: amounts.grossAmountHuf,
        utilityType: entry.utilityType as typeof meterReadings.$inferSelect.utilityType,
        sourceType: "reading_cost",
      });
    }
  }

  return { items, warnings };
}

// ---------------------------------------------------------------------------
// Process a single property
// ---------------------------------------------------------------------------

async function processProperty(
  property: PropertyRow,
  today: Date,
): Promise<PropertyResult> {
  const result: PropertyResult = {
    propertyId: property.id,
    propertyName: property.name,
    status: "skipped",
  };

  try {
    // Validate landlord profile
    if (!property.landlordProfile) {
      result.reason = "Nincs bérbeadói profil hozzárendelve";
      return result;
    }

    const sellerProfile = property.landlordProfile;

    // Compute period
    const { periodFrom, periodTo, monthIndex, monthYear } = computePeriod(
      property.billingMode,
      today,
    );

    // Check if invoice already exists for this period
    const existingInvoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.propertyId, property.id),
        eq(invoices.periodFrom, periodFrom),
        eq(invoices.periodTo, periodTo),
      ),
    });

    if (existingInvoice) {
      result.reason = `Számla már létezik erre az időszakra (${periodFrom} - ${periodTo})`;
      return result;
    }

    // Resolve active tenancy
    const activeTenancy: ActiveTenancy = property.tenancies[0] ?? null;

    // Build items
    const missingReadingsMode = property.autoBillingMissingReadings;
    const { items } = await buildItemsForProperty(
      property,
      periodFrom,
      periodTo,
      missingReadingsMode,
    );

    // For draft_only mode with no items, still skip
    if (items.length === 0) {
      result.reason = "Nincs számlázható tétel";
      return result;
    }

    // Compute totals
    const netTotalHuf = roundAmount(
      items.reduce((sum, item) => sum + item.netAmountHuf, 0),
    );
    const vatTotalHuf = roundAmount(
      items.reduce((sum, item) => sum + item.vatAmountHuf, 0),
    );
    const grossTotalHuf = roundAmount(
      items.reduce((sum, item) => sum + item.grossAmountHuf, 0),
    );

    // Resolve buyer
    const buyer = resolveBuyer(property, activeTenancy);

    // Build note
    const monthName = HUNGARIAN_MONTHS_DISPLAY[monthIndex];
    const note = `Bérleti díj és rezsi — ${monthYear}. ${monthName}`;

    // Issue date = today
    const issueDate = today.toISOString().split("T")[0]!;

    // Due date
    const dueDate = computeDefaultDueDate(
      issueDate,
      property.billingDueDay || sellerProfile.defaultDueDays,
    );

    const vatCode = property.billingVatCode?.trim() || "TAM";
    const externalId = `rezsi-auto-${property.id}-${Date.now()}`;

    // Determine if we should send to provider
    const isDraftOnly = missingReadingsMode === "draft_only";
    const agentKeyConfigured =
      !!sellerProfile.agentKey && sellerProfile.agentKey.length > 10;
    const hasAddress = !!buyer.address;
    const canSend = !isDraftOnly && agentKeyConfigured && hasAddress;

    // Insert invoice
    const [invoice] = await db
      .insert(invoices)
      .values({
        landlordId: property.landlordId,
        propertyId: property.id,
        sellerProfileId: sellerProfile.id,
        tenantId: activeTenancy?.tenant?.id ?? null,
        status: "draft",
        issueDate,
        dueDate,
        fulfillmentDate: periodTo,
        periodFrom,
        periodTo,
        paymentMethod: "transfer",
        buyerName: buyer.name,
        buyerEmail: buyer.email ?? null,
        buyerAddress: buyer.address ?? null,
        buyerTaxNumber: buyer.taxNumber ?? null,
        buyerType: buyer.buyerType,
        vatCode,
        sellerDisplayName: sellerProfile.displayName,
        sellerName: sellerProfile.billingName,
        sellerEmail: sellerProfile.billingEmail ?? null,
        sellerAddress: sellerProfile.billingAddress ?? null,
        sellerTaxNumber: sellerProfile.taxNumber ?? null,
        sellerProfileType: sellerProfile.profileType,
        note,
        netTotalHuf,
        vatTotalHuf,
        grossTotalHuf,
      })
      .returning();

    if (!invoice) {
      result.status = "error";
      result.reason = "A számla mentése nem sikerült";
      return result;
    }

    // Insert items
    await db.insert(invoiceItems).values(
      items.map((item, index) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceHuf: item.unitPriceHuf,
        netAmountHuf: item.netAmountHuf,
        vatRate: parseVatRate(item.vatRate).percentage,
        vatCode: item.vatRate,
        vatAmountHuf: item.vatAmountHuf,
        grossAmountHuf: item.grossAmountHuf,
        utilityType: item.utilityType,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sortOrder: index,
      })),
    );

    result.invoiceId = invoice.id;

    // Send to Szamlazz.hu if possible
    if (canSend) {
      try {
        const providerResult = await createInvoiceWithSzamlazz({
          agentKey: sellerProfile.agentKey ?? "",
          eInvoice: sellerProfile.eInvoice,
          externalId,
          issueDate,
          fulfillmentDate: periodTo,
          dueDate,
          paymentMethodLabel: "átutalás",
          note,
          buyer: {
            name: buyer.name,
            email: buyer.email,
            rawAddress: buyer.address ?? "",
            taxNumber: buyer.taxNumber,
            buyerType: buyer.buyerType,
          },
          items,
        });

        await db
          .update(invoices)
          .set({
            status: "sent",
            invoiceNumber: providerResult.invoiceNumber,
            providerInvoiceId: providerResult.providerInvoiceId,
            pdfUrl: providerResult.pdfUrl,
            grossTotalHuf:
              providerResult.grossTotalHuf > 0
                ? providerResult.grossTotalHuf
                : grossTotalHuf,
            netTotalHuf:
              providerResult.netTotalHuf > 0
                ? providerResult.netTotalHuf
                : netTotalHuf,
            emailedToBuyer: !!buyer.email,
          })
          .where(eq(invoices.id, invoice.id));

        result.status = "sent";
        result.invoiceNumber = providerResult.invoiceNumber;
      } catch (szamlazzError) {
        // Invoice was created as draft, but Szamlazz.hu failed
        const message =
          szamlazzError instanceof Error
            ? szamlazzError.message
            : "Ismeretlen Számlázz.hu hiba";
        result.status = "created";
        result.reason = `Számla létrehozva (draft), de Számlázz.hu küldés sikertelen: ${message}`;
        console.error(
          `[cron] Számlázz.hu error for property ${property.id}:`,
          message,
        );
      }
    } else {
      result.status = "created";
      if (isDraftOnly) {
        result.reason = "draft_only mód — csak piszkozat készült";
      } else if (!agentKeyConfigured) {
        result.reason = "Számlázz.hu Agent kulcs nincs beállítva — piszkozat készült";
      } else if (!hasAddress) {
        result.reason = "Nincs vevő cím megadva — piszkozat készült";
      }
    }

    return result;
  } catch (error) {
    result.status = "error";
    result.reason =
      error instanceof Error ? error.message : "Ismeretlen hiba";
    console.error(`[cron] Error processing property ${property.id}:`, error);
    return result;
  }
}

// ---------------------------------------------------------------------------
// GET handler — called by Vercel Cron
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = new Date();
  const dayOfMonth = today.getUTCDate();

  console.log(
    `[cron] generate-invoices started — day ${dayOfMonth}, ${today.toISOString()}`,
  );

  // Query all properties with auto-billing enabled for today's day
  const eligibleProperties = await db.query.properties.findMany({
    where: and(
      eq(properties.autoBilling, true),
      eq(properties.autoBillingDay, dayOfMonth),
      eq(properties.archived, false),
    ),
    with: {
      tenancies: {
        where: eq(tenancies.active, true),
        with: { tenant: true },
        limit: 1,
      },
      commonFees: {
        where: eq(commonFees.isActive, true),
      },
      landlordProfile: true,
    },
  });

  console.log(
    `[cron] Found ${eligibleProperties.length} eligible properties for day ${dayOfMonth}`,
  );

  const results: PropertyResult[] = [];

  for (const property of eligibleProperties) {
    const propResult = await processProperty(property as PropertyRow, today);
    results.push(propResult);
    console.log(
      `[cron] Property ${property.id} (${property.name}): ${propResult.status}${propResult.reason ? ` — ${propResult.reason}` : ""}`,
    );
  }

  const summary = {
    timestamp: today.toISOString(),
    dayOfMonth,
    totalEligible: eligibleProperties.length,
    sent: results.filter((r) => r.status === "sent").length,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };

  console.log(
    `[cron] generate-invoices done — sent: ${summary.sent}, created: ${summary.created}, skipped: ${summary.skipped}, errors: ${summary.errors}`,
  );

  return Response.json(summary);
}
