import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { landlordProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
  requireLandlordProfileAccess,
  requireLandlordPropertyAccess,
} from "@/server/api/access";
import { createInvoiceWithSzamlazz } from "@/server/billing/szamlazz";
import type { db } from "@/server/db";
import {
  commonFees,
  invoiceItems,
  invoices,
  landlordProfiles,
  meterReadings,
  properties,
  tenancies,
} from "@/server/db/schema";
import type { users } from "@/server/db/schema";
import { ensureDefaultLandlordProfile } from "@/server/landlord-profiles/service";

type PreviewSellerProfile = typeof landlordProfiles.$inferSelect;
type PreviewActiveTenancy =
  | (typeof tenancies.$inferSelect & {
      tenant: typeof users.$inferSelect | null;
    })
  | null;
type PreviewProperty = typeof properties.$inferSelect & {
  commonFees: Array<typeof commonFees.$inferSelect>;
  tenancies: Array<
    typeof tenancies.$inferSelect & {
      tenant: typeof users.$inferSelect | null;
    }
  >;
  landlordProfile: PreviewSellerProfile | null;
};
type PreviewItem = {
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
type InvoicePreviewData = {
  property: PreviewProperty;
  activeTenancy: PreviewActiveTenancy;
  sellerProfile: PreviewSellerProfile;
  issueDate: string;
  dueDate: string;
  paymentMethod: "stripe" | "cash" | "transfer";
  note?: string;
  items: PreviewItem[];
  netTotalHuf: number;
  vatTotalHuf: number;
  grossTotalHuf: number;
  vatCode: string;
};

function mapPaymentMethodToProvider(
  paymentMethod: "stripe" | "cash" | "transfer",
) {
  if (paymentMethod === "cash") return "készpénz";
  if (paymentMethod === "stripe") return "bankkártya";
  return "átutalás";
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function parseVatRate(vatCode: string) {
  const normalized = vatCode.trim().toUpperCase();
  if (normalized === "TAM" || normalized === "AAM") {
    return {
      code: normalized,
      percentage: 0,
    };
  }

  const percentage = Number(normalized);
  if (Number.isFinite(percentage) && percentage >= 0) {
    return {
      code: normalized,
      percentage,
    };
  }

  return {
    code: "TAM",
    percentage: 0,
  };
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

function resolveBuyer(
  property: PreviewProperty,
  activeTenancy: PreviewActiveTenancy,
) {
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
      source: "billing_profile" as const,
    };
  }

  if (tenantDisplayName.length > 0) {
    return {
      name: tenantDisplayName,
      email: activeTenancy?.tenant?.email ?? null,
      address: property.address ?? null,
      taxNumber: null,
      buyerType: "individual" as const,
      source: "tenant" as const,
    };
  }

  if (activeTenancy?.tenant?.email) {
    return {
      name: activeTenancy.tenant.email,
      email: activeTenancy.tenant.email,
      address: property.address ?? null,
      taxNumber: null,
      buyerType: "individual" as const,
      source: "tenant_email" as const,
    };
  }

  if (propertyContactName.length > 0) {
    return {
      name: propertyContactName,
      email: property.contactEmail ?? null,
      address: resolvedBillingAddress,
      taxNumber: billingTaxNumber || null,
      buyerType: property.billingBuyerType,
      source: "property_contact" as const,
    };
  }

  return {
    name: propertyName,
    email: property.contactEmail ?? null,
    address: resolvedBillingAddress,
    taxNumber: billingTaxNumber || null,
    buyerType: property.billingBuyerType,
    source: "property_name" as const,
  };
}

function resolveSellerProfile(
  property: PreviewProperty,
): PreviewSellerProfile {
  if (!property.landlordProfile) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Ehhez az ingatlanhoz még nincs bérbeadói profil rendelve",
    });
  }

  return property.landlordProfile;
}

function buildInvoiceReadiness(params: {
  activeTenancy: PreviewActiveTenancy;
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

  if (params.buyer.buyerType === "company" && !params.buyer.taxNumber) {
    blockers.push("Céges vevőhöz add meg az adószámot is.");
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
): Promise<InvoicePreviewData> {
  await requireLandlordPropertyAccess(ctx, input.propertyId);

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
      landlordProfile: true,
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
  const invoiceVatCode = property.billingVatCode?.trim() || "TAM";
  const sellerProfile = resolveSellerProfile(property);

  const items: PreviewItem[] = [];

  if (input.includeRent && property.monthlyRent && property.monthlyRent > 0) {
    const amounts = applyVat(property.monthlyRent, invoiceVatCode);
    items.push({
      description: `Bérleti díj (${input.periodFrom} - ${input.periodTo})`,
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

  if (input.includeCommonFees) {
    for (const fee of property.commonFees) {
      const amounts = applyVat(fee.monthlyAmount, invoiceVatCode);
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
    const amounts = applyVat(roundAmount(entry.grossAmountHuf), invoiceVatCode);
    items.push({
      description: entry.description,
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
    sellerProfile,
    issueDate: input.issueDate ?? input.periodFrom,
    dueDate:
      input.dueDate ??
      computeDefaultDueDate(
        input.issueDate ?? input.periodFrom,
        property.billingDueDay || sellerProfile.defaultDueDays,
      ),
    paymentMethod: input.paymentMethod,
    note: input.note,
    items,
    netTotalHuf,
    vatTotalHuf,
    grossTotalHuf,
    vatCode: invoiceVatCode,
  };
}

export const invoiceRouter = createTRPCRouter({
  getSettings: landlordProcedure
    .input(
      z
        .object({
          profileId: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const profile =
        input?.profileId != null
          ? await requireLandlordProfileAccess(ctx, input.profileId)
          : await ensureDefaultLandlordProfile(ctx.db, ctx.dbUser);

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nincs elérhető bérbeadói profil",
        });
      }

      return {
        profileId: profile.id,
        profileName: profile.displayName,
        agentKey: profile.agentKey ?? "",
        eInvoice: profile.eInvoice,
        defaultDueDays: profile.defaultDueDays,
        configured: (profile.agentKey ?? "").length > 10,
      };
    }),

  saveSettings: landlordProcedure
    .input(
      z.object({
        profileId: z.number(),
        agentKey: z.string().min(1),
        eInvoice: z.boolean().default(true),
        defaultDueDays: z.number().int().min(0).max(90).default(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordProfileAccess(ctx, input.profileId);

      await ctx.db
        .update(landlordProfiles)
        .set({
          agentKey: input.agentKey,
          eInvoice: input.eInvoice,
          defaultDueDays: input.defaultDueDays,
        })
        .where(
          and(
            eq(landlordProfiles.id, input.profileId),
            eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
          ),
        );

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
    const sellerProfile = preview.sellerProfile;
    const readiness = buildInvoiceReadiness({
      activeTenancy: preview.activeTenancy,
      buyer,
      agentKeyConfigured: !!sellerProfile.agentKey && sellerProfile.agentKey.length > 10,
      itemCount: preview.items.length,
    });

    return {
      property: {
        id: preview.property.id,
        name: preview.property.name,
        address: preview.property.address,
        landlordProfileId: preview.property.landlordProfileId,
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
        taxNumber: buyer.taxNumber,
        buyerType: buyer.buyerType,
        source: buyer.source,
      },
      sellerProfile: {
        id: sellerProfile.id,
        displayName: sellerProfile.displayName,
        billingName: sellerProfile.billingName,
        billingEmail: sellerProfile.billingEmail,
        billingAddress: sellerProfile.billingAddress,
        taxNumber: sellerProfile.taxNumber,
        profileType: sellerProfile.profileType,
        configured: !!sellerProfile.agentKey && sellerProfile.agentKey.length > 10,
      },
      billingDefaults: {
        vatCode: preview.vatCode,
        billingMode: preview.property.billingMode,
        billingDueDay: preview.property.billingDueDay,
      },
      issueDate: preview.issueDate,
      dueDate: preview.dueDate,
      items: preview.items,
      netTotalHuf: preview.netTotalHuf,
      vatTotalHuf: preview.vatTotalHuf,
      grossTotalHuf: preview.grossTotalHuf,
      providerReady: !!sellerProfile.agentKey && sellerProfile.agentKey.length > 10,
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
      const sellerProfile = preview.sellerProfile;
      const readiness = buildInvoiceReadiness({
        activeTenancy: preview.activeTenancy,
        buyer,
        agentKeyConfigured: !!sellerProfile.agentKey && sellerProfile.agentKey.length > 10,
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
      const buyerTaxNumber = buyer.taxNumber;
      const buyerType = buyer.buyerType;
      const externalId = `rezsi-${preview.property.id}-${Date.now()}`;

      const [invoice] = await ctx.db
        .insert(invoices)
        .values({
          landlordId: ctx.dbUser.id,
          propertyId: preview.property.id,
          sellerProfileId: sellerProfile.id,
          tenantId: preview.activeTenancy?.tenant?.id ?? null,
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
          buyerTaxNumber: buyerTaxNumber ?? null,
          buyerType,
          vatCode: preview.vatCode,
          sellerDisplayName: sellerProfile.displayName,
          sellerName: sellerProfile.billingName,
          sellerEmail: sellerProfile.billingEmail ?? null,
          sellerAddress: sellerProfile.billingAddress ?? null,
          sellerTaxNumber: sellerProfile.taxNumber ?? null,
          sellerProfileType: sellerProfile.profileType,
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

      if (input.sendToProvider) {
        if (!readiness.canSendToProvider) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: readiness.blockers[0] ?? "A számla még nem küldhető a Számlázz.hu felé",
          });
        }

        const providerResult = await createInvoiceWithSzamlazz({
          agentKey: sellerProfile.agentKey ?? "",
          eInvoice: sellerProfile.eInvoice,
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
            taxNumber: buyerTaxNumber,
            buyerType,
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
