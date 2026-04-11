import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { access } from "node:fs/promises";
import path from "node:path";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import {
  requireLandlordPropertyAccess,
  requireLandlordProfileAccess,
  requireTariffGroupAccess,
} from "@/server/api/access";
import { ensureDefaultLandlordProfile } from "@/server/landlord-profiles/service";
import { properties } from "@/server/db/schema";
import { parseLandlordProfileScopeFromHeader } from "@/lib/landlord-profile-scope";

async function sanitizeAvatarUrl<T extends { avatarUrl?: string | null }>(
  property: T,
): Promise<T> {
  const avatarUrl = property.avatarUrl;
  if (!avatarUrl?.startsWith("/uploads/")) {
    return property;
  }

  const relativePath = avatarUrl.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  try {
    await access(absolutePath);
    return property;
  } catch {
    return {
      ...property,
      avatarUrl: null,
    };
  }
}

export const propertyRouter = createTRPCRouter({
  list: landlordProcedure.query(async ({ ctx }) => {
    const scopeProfileIds = parseLandlordProfileScopeFromHeader(
      ctx.headers.get("cookie"),
    );
    const whereConditions = [
      eq(properties.landlordId, ctx.dbUser.id),
      eq(properties.archived, false),
    ];

    if (scopeProfileIds) {
      whereConditions.push(inArray(properties.landlordProfileId, scopeProfileIds));
    }

    const propertyList = await ctx.db.query.properties.findMany({
      where: and(...whereConditions),
      with: {
        tenancies: {
          where: (t, { eq }) => eq(t.active, true),
          with: { tenant: true },
        },
        meterInfo: true,
        tariffGroup: true,
        building: true,
        landlordProfile: true,
        handoverChecklists: {
          where: (c, { eq }) => eq(c.status, "pending"),
        },
      },
      orderBy: (p, { asc }) => [asc(p.name)],
    });

    return Promise.all(propertyList.map((property) => sanitizeAvatarUrl(property)));
  }),

  get: landlordProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.id),
          eq(properties.landlordId, ctx.dbUser.id),
        ),
        with: {
          tenancies: { with: { tenant: true } },
          meterInfo: true,
          readings: {
            orderBy: (r, { desc }) => [desc(r.readingDate)],
            limit: 20,
          },
          payments: {
            orderBy: (p, { desc }) => [desc(p.paymentDate)],
            limit: 10,
          },
          invoices: {
            orderBy: (i, { desc }) => [desc(i.issueDate)],
            limit: 10,
            with: { items: true },
          },
          maintenanceLogs: {
            orderBy: (m, { desc }) => [desc(m.createdAt)],
            limit: 10,
          },
          documents: {
            orderBy: (d, { desc }) => [desc(d.uploadedAt)],
          },
          smartMeters: true,
          wifiNetworks: true,
          commonFees: { with: { paymentsTracking: true } },
          propertyTaxes: true,
          tenantInvitations: true,
          tenantHistory: {
            orderBy: (h, { desc }) => [desc(h.createdAt)],
          },
          handoverChecklists: {
            orderBy: (c, { asc }) => [asc(c.createdAt)],
          },
          tariffGroup: { with: { tariffs: true } },
          building: true,
          landlordProfile: true,
          chatMessages: {
            orderBy: (c, { desc }) => [desc(c.createdAt)],
            limit: 50,
          },
        },
      });

      return property ? sanitizeAvatarUrl(property) : null;
    }),

  create: landlordProcedure
    .input(
      z.object({
        name: z.string().min(1),
        propertyType: z.string().min(1).max(50),
        address: z.string().optional(),
        notes: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        billingName: z.string().optional(),
        billingEmail: z.string().optional(),
        billingAddress: z.string().optional(),
        billingTaxNumber: z.string().optional(),
        billingBuyerType: z.enum(["individual", "company"]).optional(),
        billingVatCode: z.enum(["TAM", "AAM", "27"]).optional(),
        billingMode: z.enum(["advance", "arrears"]).optional(),
        billingDueDay: z.number().int().min(1).max(31).optional(),
        landlordProfileId: z.number().optional(),
        autoBilling: z.boolean().optional(),
        autoBillingDay: z.number().int().min(1).max(28).optional(),
        autoBillingMissingReadings: z.enum(["estimate", "skip_readings", "draft_only"]).optional(),
        purchasePrice: z.number().optional(),
        monthlyRent: z.number().optional(),
        rentCurrency: z.enum(["HUF", "EUR"]).optional(),
        tariffGroupId: z.number().optional(),
        buildingPropertyId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let landlordProfileId = input.landlordProfileId;
      if (input.tariffGroupId) {
        await requireTariffGroupAccess(ctx, input.tariffGroupId);
      }
      if (landlordProfileId) {
        await requireLandlordProfileAccess(ctx, landlordProfileId);
      } else {
        landlordProfileId = (await ensureDefaultLandlordProfile(ctx.db, ctx.dbUser))?.id;
      }
      if (input.buildingPropertyId) {
        await requireLandlordPropertyAccess(ctx, input.buildingPropertyId);
      }

      const [property] = await ctx.db
        .insert(properties)
        .values({
          landlordId: ctx.dbUser.id,
          ...input,
          landlordProfileId,
        })
        .returning();
      revalidatePath("/properties");
      return property;
    }),

  update: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        propertyType: z.string().min(1).max(50).optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        billingName: z.string().optional(),
        billingEmail: z.string().optional(),
        billingAddress: z.string().optional(),
        billingTaxNumber: z.string().optional(),
        billingBuyerType: z.enum(["individual", "company"]).optional(),
        billingVatCode: z.enum(["TAM", "AAM", "27"]).optional(),
        billingMode: z.enum(["advance", "arrears"]).optional(),
        billingDueDay: z.number().int().min(1).max(31).optional(),
        landlordProfileId: z.number().optional(),
        autoBilling: z.boolean().optional(),
        autoBillingDay: z.number().int().min(1).max(28).optional(),
        autoBillingMissingReadings: z.enum(["estimate", "skip_readings", "draft_only"]).optional(),
        purchasePrice: z.number().optional(),
        monthlyRent: z.number().optional(),
        rentCurrency: z.enum(["HUF", "EUR"]).optional(),
        tariffGroupId: z.number().optional(),
        buildingPropertyId: z.number().optional(),
        avatarUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await requireLandlordPropertyAccess(ctx, id);
      if (data.tariffGroupId) {
        await requireTariffGroupAccess(ctx, data.tariffGroupId);
      }
      if (data.landlordProfileId) {
        await requireLandlordProfileAccess(ctx, data.landlordProfileId);
      }
      if (data.buildingPropertyId) {
        await requireLandlordPropertyAccess(ctx, data.buildingPropertyId);
      }

      await ctx.db
        .update(properties)
        .set(data)
        .where(
          and(eq(properties.id, id), eq(properties.landlordId, ctx.dbUser.id)),
        );
      revalidatePath("/properties");
      revalidatePath(`/properties/${id}`);
    }),

  archive: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(properties)
        .set({ archived: true })
        .where(
          and(
            eq(properties.id, input.id),
            eq(properties.landlordId, ctx.dbUser.id),
          ),
        );
    }),
});
