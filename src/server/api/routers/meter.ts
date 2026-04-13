import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { meterInfo, meterReadings, smartMeterDevices, properties } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const meterRouter = createTRPCRouter({
  get: landlordProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const meter = await ctx.db.query.meterInfo.findFirst({
        where: eq(meterInfo.id, input.id),
        with: { tariffGroup: true },
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

      // Also find siblings by address match (same landlord, same address)
      if (property.address) {
        const addrSiblings = await ctx.db.query.properties.findMany({
          where: and(
            eq(properties.landlordId, ctx.dbUser.id),
            eq(properties.address, property.address),
          ),
          columns: { id: true },
        });
        addrSiblings.forEach((s) => siblingIds.add(s.id));
      }

      const meters = await ctx.db.query.meterInfo.findMany({
        where: inArray(meterInfo.propertyId, [...siblingIds]),
        with: { property: { columns: { id: true, name: true } } },
      });
      return meters;
    }),

  /** Get calculated consumption for a virtual meter */
  virtualConsumption: landlordProcedure
    .input(z.object({ meterId: z.number() }))
    .query(async ({ ctx, input }) => {
      const meter = await ctx.db.query.meterInfo.findFirst({
        where: eq(meterInfo.id, input.meterId),
      });
      if (!meter || meter.meterType !== "virtual" || !meter.primaryMeterId) return null;
      await requireLandlordPropertyAccess(ctx, meter.propertyId);

      const subtractIds = Array.isArray(meter.subtractMeterIds) ? (meter.subtractMeterIds as number[]) : [];

      // Get last 12 months of readings for primary meter
      const primaryReadings = await ctx.db.query.meterReadings.findMany({
        where: eq(meterReadings.meterInfoId, meter.primaryMeterId),
        orderBy: [desc(meterReadings.readingDate)],
        limit: 12,
      });

      // Get subtract meter readings — indexed by both exact date and month
      const subByDate = new Map<string, number>();
      const subByMonth = new Map<string, number>();
      for (const sid of subtractIds) {
        const subReadings = await ctx.db.query.meterReadings.findMany({
          where: eq(meterReadings.meterInfoId, sid),
          orderBy: [desc(meterReadings.readingDate)],
          limit: 12,
        });
        for (const r of subReadings) {
          subByDate.set(r.readingDate, (subByDate.get(r.readingDate) ?? 0) + (r.consumption ?? 0));
          const month = r.readingDate.substring(0, 7);
          if (!subByMonth.has(month)) {
            subByMonth.set(month, r.consumption ?? 0);
          } else {
            subByMonth.set(month, (subByMonth.get(month) ?? 0) + (r.consumption ?? 0));
          }
        }
      }

      // Calculate per-month — try exact date first, fallback to month
      const months = primaryReadings.map((pr) => {
        const readingMonth = pr.readingDate.substring(0, 7);
        const subtracted = subByDate.get(pr.readingDate) ?? subByMonth.get(readingMonth) ?? 0;
        const calculated = Math.max(0, (pr.consumption ?? 0) - subtracted);
        return {
          readingDate: pr.readingDate,
          primaryConsumption: pr.consumption ?? 0,
          subtractConsumption: subtracted,
          calculatedConsumption: Math.round(calculated * 100) / 100,
        };
      });

      // Get subtract meter names
      const subtractNames: string[] = [];
      for (const sid of subtractIds) {
        const sm = await ctx.db.query.meterInfo.findFirst({
          where: eq(meterInfo.id, sid),
          with: { property: { columns: { name: true } } },
        });
        subtractNames.push(sm?.property?.name ?? sm?.location ?? "almérő");
      }

      return {
        months,
        latestCalculated: months[0]?.calculatedConsumption ?? null,
        latestPrimary: months[0]?.primaryConsumption ?? null,
        latestSubtract: months[0]?.subtractConsumption ?? null,
        subtractNames,
      };
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

      // Build update data — explicitly include virtual meter fields even when null
      const updateData: Record<string, unknown> = { ...data };
      if ("primaryMeterId" in input) updateData.primaryMeterId = input.primaryMeterId;
      if ("subtractMeterIds" in input) updateData.subtractMeterIds = input.subtractMeterIds;
      if ("meterType" in input) updateData.meterType = input.meterType;
      if ("formulaType" in input) updateData.formulaType = input.formulaType;

      await ctx.db.update(meterInfo).set(updateData).where(eq(meterInfo.id, id));
      return { success: true };
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
