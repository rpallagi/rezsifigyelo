import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { meterInfo, smartMeterDevices } from "@/server/db/schema";

export const meterRouter = createTRPCRouter({
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [meter] = await ctx.db.insert(meterInfo).values(input).returning();
      return meter;
    }),

  update: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        location: z.string().optional(),
        serialNumber: z.string().optional(),
        tariffGroupId: z.number().nullable().optional(),
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
