import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { meterInfo, meterReadings } from "@/server/db/schema";

export const meterRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.meterInfo.findMany({
        where: eq(meterInfo.propertyId, input.propertyId),
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
        location: z.string().optional(),
        serialNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [meter] = await ctx.db.insert(meterInfo).values(input).returning();
      return meter;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        location: z.string().optional(),
        serialNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(meterInfo).set(data).where(eq(meterInfo.id, id));
    }),
});
