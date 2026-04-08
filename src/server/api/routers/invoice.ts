import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { landlordProcedure, createTRPCRouter } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { getInvoiceSettings, saveInvoiceSettings } from "@/server/billing/settings";
import { createInvoiceWithSzamlazz } from "@/server/billing/szamlazz";
import type { db } from "@/server/db";
import {
  commonFees,
  invoiceItems,
  invoices,
  meterReadings,
  properties,
  tenancies,
} from "@/server/db/schema";
import type { users } from "@/server/db/schema";

function mapPaymentMethodToProvider(
  paymentMethod: "stripe" | "cash" | "transfer",
) {
  if (paymentMethod === "cash") return "készpénz";
  if (paymentMethod === "stripe") return "bankkártya";
  return "átutalás";
}

function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0]!;
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveBuyer(
  property: Awaited<ReturnType<typeof buildInvoicePreview>>["property"],
  activeTenancy: Awaited<ReturnType<typeof buildInvoicePreview>>["activeTenancy"],
) {
  const tenantDisplayName =
    `${activeTenancy?.tenant.firstName ?? ""} ${activeTenancy?.tenant.lastName ?? ""}`.trim();
  const propertyContactName = property.contactName?.trim() ?? "";
  const propertyName = property.name.trim();

  if (tenantDisplayName.length > 0) {
    return {
      name: tenantDisplayName,
      email: activeTenancy?.tenant.email ?? null,
      address: property.address ?? null,
      source: "tenant" as const,
    };
  }

  if (activeTenancy?.tenant.email) {
    return {
      name: activeTenancy.tenant.email,
      email: activeTenancy.tenant.email,
      address: property.address ?? null,
      source: "tenant_email" as const,
    };
  }

  if (propertyContactName.length > 0) {
    return {
      name: propertyContactName,
      email: property.contactEmail ?? null,
      address: property.address ?? null,
      source: "property_contact" as const,
    };
  }

  return {
    name: propertyName,
    email: property.contactEmail ?? null,
    address: property.address ?? null,
    source: "property_name" as const,
  };
}

function buildInvoiceReadiness(params: {
  activeTenancy: Awaited<ReturnType<typeof buildInvoicePreview>>["activeTenancy"];
  buyer: ReturnType<typeof resolveBuyer>;
  agentKeyConfigured: boolean;
  itemCount: number;
}) {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!params.activeTenancy) {
    warnings.push(
      "Nincs aktív bérlő ennél az ingatlannál. A rendszer a kapcsolattartó vagy az ingatlan nevét használja vevőként.",
    );
  }

  if (!params.buyer.email) {
    warnings.push(
      "Nincs vevő email megadva. A számla létrejöhet, de emailben nem lesz kiküldve.",
    );
  }

  if (!params.agentKeyConfigured) {
    blockers.push("A Számlázz.hu Agent kulcs még nincs beállítva.");
  }

  if (!params.buyer.address) {
    blockers.push("A Számlázz.hu küldéshez teljes ingatlancím szükséges.");
  }

  if (params.itemCount === 0) {
    blockers.push("Nincs számlázható tétel a kiválasztott időszakban.");
  }

  return {
    warnings,
    blockers,
    canSendToProvider: blockers.length === 0,
  };
}

const previewInputSchema = z.object({
  propertyId: z.number(),
  periodFrom: z.string(),
  periodTo: z.string(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  includeRent: z.boolean().default(true),
  includeCommonFees: z.boolean().default(true),
  includeReadings: z.boolean().default(true),
  note: z.string().optional(),
  paymentMethod: z.enum(["stripe", "cash", "transfer"]).default("transfer"),
});

async function buildInvoicePreview(
  ctx: {
    db: typeof db;
    dbUser: typeof users.$inferSelect;
    headers: Headers;
  },
  input: z.infer<typeof previewInputSchema>,
) {
  await requireLandlordPropertyAccess(ctx, input.propertyId);

  const settings = await getInvoiceSettings(ctx.db, ctx.dbUser.id);
  const property = await ctx.db.query.properties.findFirst({
    where: and(
      eq(properties.id, input.propertyId),
      eq(properties.landlordId, ctx.dbUser.id),
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
    },
  });

  if (!property) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
  }

  const readings = input.includeReadings
    ? await ctx.db.query.meterReadings.findMany({
        where: and(
          eq(meterReadings.propertyId, property.id),
          gte(meterReadings.readingDate, input.periodFrom),
          lte(meterReadings.readingDate, input.periodTo),
        ),
        orderBy: [desc(meterReadings.readingDate)],
      })
    : [];

  const activeTenancy = property.tenancies[0] ?? null;

  const items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPriceHuf: number;
    netAmountHuf: number;
    vatRate: number;
    vatAmountHuf: number;
    grossAmountHuf: number;
    utilityType?: typeof meterReadings.$inferSelect.utilityType;
    sourceType: string;
    sourceId?: number;
  }> = [];

  if (input.includeRent && property.monthlyRent && property.monthlyRent > 0) {
    items.push({
      description: `Bérleti díj (${input.periodFrom} - ${input.periodTo})`,
      quantity: 1,
      unit: "hó",
      unitPriceHuf: property.monthlyRent,
      netAmountHuf: property.monthlyRent,
      vatRate: 0,
      vatAmountHuf: 0,
      grossAmountHuf: property.monthlyRent,
      sourceType: "rent",
    });
  }

  if (input.includeCommonFees) {
    for (const fee of property.commonFees) {
      items.push({
        description: fee.recipient
          ? `Közös költség - ${fee.recipient}`
          : "Közös költség",
        quantity: 1,
        unit: fee.frequency === "quarterly" ? "negyedév" : "hó",
        unitPriceHuf: fee.monthlyAmount,
        netAmountHuf: fee.monthlyAmount,
        vatRate: 0,
        vatAmountHuf: 0,
        grossAmountHuf: fee.monthlyAmount,
        sourceType: "common_fee",
        sourceId: fee.id,
      });
    }
  }

  const groupedReadings = new Map<
    string,
    { grossAmountHuf: number; description: string; utilityType: string; count: number }
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
        description: `${reading.utilityType} fogyasztás (${input.periodFrom} - ${input.periodTo})`,
        utilityType: reading.utilityType,
        count: 1,
      });
    }
  }

  for (const entry of groupedReadings.values()) {
    items.push({
      description: entry.description,
      quantity: 1,
      unit: "időszak",
      unitPriceHuf: roundAmount(entry.grossAmountHuf),
      netAmountHuf: roundAmount(entry.grossAmountHuf),
      vatRate: 0,
      vatAmountHuf: 0,
      grossAmountHuf: roundAmount(entry.grossAmountHuf),
      utilityType: entry.utilityType as typeof meterReadings.$inferSelect.utilityType,
      sourceType: "reading_cost",
    });
  }

  const netTotalHuf = roundAmount(
    items.reduce((sum, item) => sum + item.netAmountHuf, 0),
  );
  const vatTotalHuf = roundAmount(
    items.reduce((sum, item) => sum + item.vatAmountHuf, 0),
  );
  const grossTotalHuf = roundAmount(
    items.reduce((sum, item) => sum + item.grossAmountHuf, 0),
  );

  return {
    property,
    activeTenancy,
    settings,
    issueDate: input.issueDate ?? input.periodTo,
    dueDate: input.dueDate ?? addDays(input.periodTo, settings.defaultDueDays),
    paymentMethod: input.paymentMethod,
    note: input.note,
    items,
    netTotalHuf,
    vatTotalHuf,
    grossTotalHuf,
  };
}

export const invoiceRouter = createTRPCRouter({
  getSettings: landlordProcedure.query(async ({ ctx }) => {
    const settings = await getInvoiceSettings(ctx.db, ctx.dbUser.id);
    return {
      ...settings,
      configured: settings.agentKey.length > 10,
    };
  }),

  saveSettings: landlordProcedure
    .input(
      z.object({
        agentKey: z.string().min(1),
        eInvoice: z.boolean().default(true),
        defaultDueDays: z.number().int().min(0).max(90).default(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveInvoiceSettings(ctx.db, ctx.dbUser.id, input);
      return { success: true };
    }),

  list: landlordProcedure.query(async ({ ctx }) => {
    return ctx.db.query.invoices.findMany({
      where: eq(invoices.landlordId, ctx.dbUser.id),
      with: {
        property: true,
        tenant: true,
        items: true,
      },
      orderBy: [desc(invoices.issueDate), desc(invoices.createdAt)],
      limit: 100,
    });
  }),

  preview: landlordProcedure.input(previewInputSchema).query(async ({ ctx, input }) => {
    const preview = await buildInvoicePreview(ctx, input);
    const buyer = resolveBuyer(preview.property, preview.activeTenancy);
    const readiness = buildInvoiceReadiness({
      activeTenancy: preview.activeTenancy,
      buyer,
      agentKeyConfigured: preview.settings.agentKey.length > 10,
      itemCount: preview.items.length,
    });

    return {
      property: {
        id: preview.property.id,
        name: preview.property.name,
        address: preview.property.address,
      },
      tenant: preview.activeTenancy?.tenant
        ? {
            id: preview.activeTenancy.tenant.id,
            name:
              `${preview.activeTenancy.tenant.firstName ?? ""} ${preview.activeTenancy.tenant.lastName ?? ""}`.trim() ||
              preview.activeTenancy.tenant.email,
            email: preview.activeTenancy.tenant.email,
          }
        : null,
      buyer: {
        name: buyer.name,
        email: buyer.email,
        address: buyer.address,
        source: buyer.source,
      },
      issueDate: preview.issueDate,
      dueDate: preview.dueDate,
      items: preview.items,
      netTotalHuf: preview.netTotalHuf,
      vatTotalHuf: preview.vatTotalHuf,
      grossTotalHuf: preview.grossTotalHuf,
      providerReady: preview.settings.agentKey.length > 10,
      warnings: readiness.warnings,
      blockers: readiness.blockers,
      canSendToProvider: readiness.canSendToProvider,
    };
  }),

  create: landlordProcedure
    .input(
      previewInputSchema.extend({
        sendToProvider: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const preview = await buildInvoicePreview(ctx, input);
      const buyer = resolveBuyer(preview.property, preview.activeTenancy);
      const readiness = buildInvoiceReadiness({
        activeTenancy: preview.activeTenancy,
        buyer,
        agentKeyConfigured: preview.settings.agentKey.length > 10,
        itemCount: preview.items.length,
      });

      if (preview.items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nincs számlázható tétel a kiválasztott időszakban",
        });
      }

      const buyerName = buyer.name;
      const buyerEmail = buyer.email;
      const buyerAddress = buyer.address;
      const externalId = `rezsi-${preview.property.id}-${Date.now()}`;

      const [invoice] = await ctx.db
        .insert(invoices)
        .values({
          landlordId: ctx.dbUser.id,
          propertyId: preview.property.id,
          tenantId: preview.activeTenancy?.tenant.id ?? null,
          status: "draft",
          issueDate: preview.issueDate,
          dueDate: preview.dueDate,
          fulfillmentDate: input.periodTo,
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          paymentMethod: preview.paymentMethod,
          buyerName,
          buyerEmail,
          buyerAddress: buyerAddress ?? null,
          note: input.note,
          netTotalHuf: preview.netTotalHuf,
          vatTotalHuf: preview.vatTotalHuf,
          grossTotalHuf: preview.grossTotalHuf,
        })
        .returning();

      if (!invoice) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "A számla mentése nem sikerült",
        });
      }

      await ctx.db.insert(invoiceItems).values(
        preview.items.map((item, index) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceHuf: item.unitPriceHuf,
          netAmountHuf: item.netAmountHuf,
          vatRate: item.vatRate,
          vatAmountHuf: item.vatAmountHuf,
          grossAmountHuf: item.grossAmountHuf,
          utilityType: item.utilityType,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sortOrder: index,
        })),
      );

      if (input.sendToProvider) {
        if (!readiness.canSendToProvider) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: readiness.blockers[0] ?? "A számla még nem küldhető a Számlázz.hu felé",
          });
        }

        const providerResult = await createInvoiceWithSzamlazz({
          agentKey: preview.settings.agentKey,
          eInvoice: preview.settings.eInvoice,
          externalId,
          issueDate: preview.issueDate,
          fulfillmentDate: input.periodTo,
          dueDate: preview.dueDate,
          paymentMethodLabel: mapPaymentMethodToProvider(preview.paymentMethod),
          note: input.note,
          buyer: {
            name: buyerName,
            email: buyerEmail,
            rawAddress: buyerAddress ?? "",
          },
          items: preview.items,
        });

        const [syncedInvoice] = await ctx.db
          .update(invoices)
          .set({
            status: "sent",
            invoiceNumber: providerResult.invoiceNumber,
            providerInvoiceId: providerResult.providerInvoiceId,
            pdfUrl: providerResult.pdfUrl,
            grossTotalHuf:
              providerResult.grossTotalHuf > 0
                ? providerResult.grossTotalHuf
                : preview.grossTotalHuf,
            netTotalHuf:
              providerResult.netTotalHuf > 0
                ? providerResult.netTotalHuf
                : preview.netTotalHuf,
            emailedToBuyer: !!buyerEmail,
          })
          .where(eq(invoices.id, invoice.id))
          .returning();

        if (!syncedInvoice) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "A számla szinkron utáni frissítése nem sikerült",
          });
        }

        return {
          invoice: syncedInvoice,
          synced: true,
        };
      }

      return {
        invoice,
        synced: false,
      };
    }),
});
