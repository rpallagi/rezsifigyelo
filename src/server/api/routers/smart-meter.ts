import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { smartMeterDevices, smartMeterLogs } from "@/server/db/schema";

export const smartMeterRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.smartMeterDevices.findMany({
        where: eq(smartMeterDevices.propertyId, input.propertyId),
      });
    }),

  create: protectedProcedure
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
        source: z.enum(["ttn", "mqtt", "home_assistant"]).default("mqtt"),
        name: z.string().optional(),
        mqttTopic: z.string().optional(),
        ttnAppId: z.string().optional(),
        valueField: z.string().default("meter_value"),
        multiplier: z.number().default(1.0),
        offset: z.number().default(0.0),
        deviceUnit: z.string().optional(),
        minIntervalMinutes: z.number().default(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [device] = await ctx.db
        .insert(smartMeterDevices)
        .values(input)
        .returning();
      return device;
    }),

  update: protectedProcedure
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
      await ctx.db
        .update(smartMeterDevices)
        .set(data)
        .where(eq(smartMeterDevices.id, id));
    }),

  logs: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.smartMeterLogs.findMany({
        where: eq(smartMeterLogs.deviceId, input.deviceId),
        orderBy: [desc(smartMeterLogs.receivedAt)],
        limit: input.limit,
      });
    }),
});
