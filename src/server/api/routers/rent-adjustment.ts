import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { rentAdjustments, properties, tenancies } from "@/server/db/schema";

export const rentAdjustmentRouter = createTRPCRouter({
  /** List all adjustments for a property */
  list: landlordProcedure
    .input(z.object({ propertyId: z.number().optional(), year: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(properties.landlordId, ctx.dbUser.id)];
      if (input.propertyId) {
        conditions.push(eq(rentAdjustments.propertyId, input.propertyId));
      }
      if (input.year) {
        conditions.push(eq(rentAdjustments.year, input.year));
      }
      return ctx.db.query.rentAdjustments.findMany({
        where: and(...conditions),
        with: { property: { columns: { id: true, name: true, monthlyRent: true } } },
      });
    }),

  /** Get properties eligible for inflation adjustment (active tenancy with inflationTracking) */
  eligibleProperties: landlordProcedure
    .query(async ({ ctx }) => {
      const props = await ctx.db.query.properties.findMany({
        where: eq(properties.landlordId, ctx.dbUser.id),
        with: {
          tenancies: {
            where: and(eq(tenancies.active, true), eq(tenancies.inflationTracking, true)),
            limit: 1,
          },
        },
      });
      return props
        .filter((p) => p.tenancies.length > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          monthlyRent: p.monthlyRent,
          rentCurrency: p.rentCurrency,
          tenancyId: p.tenancies[0]!.id,
          tenantName: p.tenancies[0]!.tenantName,
        }));
    }),

  /** Apply inflation adjustment to selected properties (batch) */
  applyBatch: landlordProcedure
    .input(
      z.object({
        year: z.number(),
        adjustmentType: z.enum(["inflation_estimate", "inflation_final"]),
        percentage: z.number().min(0).max(100),
        propertyIds: z.array(z.number()).min(1),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { propertyId: number; previousRent: number; newRent: number; correctionAmount: number | null }[] = [];

      for (const propertyId of input.propertyIds) {
        await requireLandlordPropertyAccess(ctx, propertyId);

        const property = await ctx.db.query.properties.findFirst({
          where: eq(properties.id, propertyId),
          columns: { monthlyRent: true },
        });
        if (!property?.monthlyRent) continue;

        // Check if there's already an estimate for this year (for correction calculation)
        const existingEstimate = await ctx.db.query.rentAdjustments.findFirst({
          where: and(
            eq(rentAdjustments.propertyId, propertyId),
            eq(rentAdjustments.year, input.year),
            eq(rentAdjustments.adjustmentType, "inflation_estimate"),
          ),
        });

        let previousRent: number;
        let newRent: number;
        let correctionAmount: number | null = null;

        if (input.adjustmentType === "inflation_estimate") {
          // January: apply estimated percentage
          previousRent = property.monthlyRent;
          newRent = Math.round(previousRent * (1 + input.percentage / 100));
        } else {
          // February: apply final percentage, calculate correction
          if (existingEstimate) {
            // Recalculate from the pre-inflation rent
            previousRent = existingEstimate.previousRent;
            newRent = Math.round(previousRent * (1 + input.percentage / 100));
            // Correction = difference between final and estimated for one month
            correctionAmount = newRent - existingEstimate.newRent;
          } else {
            // No estimate was made — apply from current rent
            previousRent = property.monthlyRent;
            newRent = Math.round(previousRent * (1 + input.percentage / 100));
          }
        }

        // Create adjustment record
        await ctx.db.insert(rentAdjustments).values({
          propertyId,
          year: input.year,
          adjustmentType: input.adjustmentType,
          percentage: input.percentage,
          previousRent,
          newRent,
          correctionAmount,
          appliedAt: new Date().toISOString().split("T")[0]!,
          note: input.note,
        });

        // Update property monthlyRent
        await ctx.db
          .update(properties)
          .set({ monthlyRent: newRent })
          .where(eq(properties.id, propertyId));

        results.push({ propertyId, previousRent, newRent, correctionAmount });
      }

      return { applied: results.length, results };
    }),
});
