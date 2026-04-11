import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { smartMeterDevices, smartMeterLogs } from "@/server/db/schema";

export const smartMeterRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.smartMeterDevices.findMany({
        where: eq(smartMeterDevices.propertyId, input.propertyId),
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
        deviceId: z.string().min(1),
        source: z.enum(["ttn", "mqtt", "home_assistant", "shelly_cloud"]).default("mqtt"),
        name: z.string().optional(),
        mqttTopic: z.string().optional(),
        ttnAppId: z.string().optional(),
        shellyDeviceId: z.string().optional(),
        shellyChannel: z.number().int().min(0).max(2).optional(),
        valueField: z.string().default("meter_value"),
        multiplier: z.number().default(1.0),
        offset: z.number().default(0.0),
        deviceUnit: z.string().optional(),
        minIntervalMinutes: z.number().default(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [device] = await ctx.db
        .insert(smartMeterDevices)
        .values(input)
        .returning();
      return device;
    }),

  update: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        valueField: z.string().optional(),
        multiplier: z.number().optional(),
        offset: z.number().optional(),
        minIntervalMinutes: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const device = await ctx.db.query.smartMeterDevices.findFirst({
        where: eq(smartMeterDevices.id, id),
      });

      if (!device) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Smart meter device not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, device.propertyId);
      await ctx.db
        .update(smartMeterDevices)
        .set(data)
        .where(eq(smartMeterDevices.id, id));
    }),

  logs: landlordProcedure
    .input(
      z.object({
        deviceId: z.string(),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const device = await ctx.db.query.smartMeterDevices.findFirst({
        where: eq(smartMeterDevices.deviceId, input.deviceId),
      });

      if (!device) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Smart meter device not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, device.propertyId);
      return ctx.db.query.smartMeterLogs.findMany({
        where: eq(smartMeterLogs.deviceId, input.deviceId),
        orderBy: [desc(smartMeterLogs.receivedAt)],
        limit: input.limit,
      });
    }),

  delete: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const device = await ctx.db.query.smartMeterDevices.findFirst({
        where: eq(smartMeterDevices.id, input.id),
      });
      if (!device) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Eszköz nem található" });
      }
      await requireLandlordPropertyAccess(ctx, device.propertyId);
      await ctx.db.delete(smartMeterDevices).where(eq(smartMeterDevices.id, input.id));
      return { success: true };
    }),
});
