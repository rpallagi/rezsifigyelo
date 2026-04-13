import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { meterInfo, smartMeterDevices, properties } from "@/server/db/schema";

export const meterRouter = createTRPCRouter({
  get: landlordProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const meter = await ctx.db.query.meterInfo.findFirst({
        where: eq(meterInfo.id, input.id),
        with: { tariffGroup: true, primaryMeter: true },
      });
      if (!meter) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mérő nem található" });
      }
      await requireLandlordPropertyAccess(ctx, meter.propertyId);
      return meter;
    }),

  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.meterInfo.findMany({
        where: eq(meterInfo.propertyId, input.propertyId),
      });
    }),

  create: landlordProcedure
    .input(
      z.object({
        propertyId: z.number(),
        utilityType: z.enum([
          "villany",
          "viz",
          "gaz",
          "csatorna",
          "internet",
          "kozos_koltseg",
          "egyeb",
        ]),
        location: z.string().optional(),
        serialNumber: z.string().optional(),
        photoUrls: z.array(z.string()).optional(),
        tariffGroupId: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [meter] = await ctx.db.insert(meterInfo).values(input).returning();
      return meter;
    }),

  /** List all meters across a building group (same address / parent) */
  listByBuilding: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);
      // Find sibling properties (same buildingPropertyId or same address)
      const property = await ctx.db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
        columns: { id: true, buildingPropertyId: true, address: true },
      });
      if (!property) return [];

      // Collect property IDs in the building group
      const siblingIds = new Set<number>([input.propertyId]);
      if (property.buildingPropertyId) {
        siblingIds.add(property.buildingPropertyId);
        const siblings = await ctx.db.query.properties.findMany({
          where: eq(properties.buildingPropertyId, property.buildingPropertyId),
          columns: { id: true },
        });
        siblings.forEach((s) => siblingIds.add(s.id));
      }
      // Also check if this property IS a parent
      const children = await ctx.db.query.properties.findMany({
        where: eq(properties.buildingPropertyId, input.propertyId),
        columns: { id: true },
      });
      children.forEach((c) => siblingIds.add(c.id));

      const meters = await ctx.db.query.meterInfo.findMany({
        where: inArray(meterInfo.propertyId, [...siblingIds]),
        with: { property: { columns: { id: true, name: true } } },
      });
      return meters;
    }),

  update: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        location: z.string().optional(),
        serialNumber: z.string().optional(),
        tariffGroupId: z.number().nullable().optional(),
        photoUrls: z.array(z.string()).optional(),
        meterType: z.enum(["physical", "virtual"]).optional(),
        formulaType: z.string().nullable().optional(),
        primaryMeterId: z.number().nullable().optional(),
        subtractMeterIds: z.array(z.number()).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const meter = await ctx.db.query.meterInfo.findFirst({
        where: eq(meterInfo.id, id),
      });

      if (!meter) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meter not found" });
      }

      await requireLandlordPropertyAccess(ctx, meter.propertyId);
      await ctx.db.update(meterInfo).set(data).where(eq(meterInfo.id, id));
    }),

  delete: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const meter = await ctx.db.query.meterInfo.findFirst({
        where: eq(meterInfo.id, input.id),
      });
      if (!meter) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mérő nem található" });
      }
      await requireLandlordPropertyAccess(ctx, meter.propertyId);
      // Delete linked smart meter devices
      await ctx.db.delete(smartMeterDevices).where(eq(smartMeterDevices.meterInfoId, input.id));
      await ctx.db.delete(meterInfo).where(eq(meterInfo.id, input.id));
      return { success: true };
    }),
});
