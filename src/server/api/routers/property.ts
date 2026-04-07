import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { properties } from "@/server/db/schema";

export const propertyRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.properties.findMany({
      where: and(
        eq(properties.landlordId, ctx.dbUser.id),
        eq(properties.archived, false),
      ),
      with: {
        tenancies: {
          where: (t, { eq }) => eq(t.active, true),
          with: { tenant: true },
        },
        meterInfo: true,
        tariffGroup: true,
        building: true,
      },
      orderBy: (p, { asc }) => [asc(p.name)],
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.properties.findFirst({
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
          tariffGroup: { with: { tariffs: true } },
          building: true,
          chatMessages: {
            orderBy: (c, { desc }) => [desc(c.createdAt)],
            limit: 50,
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        propertyType: z.enum(["lakas", "uzlet", "telek", "egyeb"]),
        address: z.string().optional(),
        notes: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        purchasePrice: z.number().optional(),
        monthlyRent: z.number().optional(),
        tariffGroupId: z.number().optional(),
        buildingPropertyId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .insert(properties)
        .values({
          landlordId: ctx.dbUser.id,
          ...input,
        })
        .returning();
      return property;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        propertyType: z.enum(["lakas", "uzlet", "telek", "egyeb"]).optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        purchasePrice: z.number().optional(),
        monthlyRent: z.number().optional(),
        tariffGroupId: z.number().optional(),
        buildingPropertyId: z.number().optional(),
        avatarUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db
        .update(properties)
        .set(data)
        .where(
          and(eq(properties.id, id), eq(properties.landlordId, ctx.dbUser.id)),
        );
    }),

  archive: protectedProcedure
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
