import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { meters, meterReadings } from "@/server/db/schema";

export const meterRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.meters.findMany({
        where: eq(meters.propertyId, input.propertyId),
        with: {
          readings: {
            orderBy: (r, { desc }) => [desc(r.readingDate)],
            limit: 1,
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        type: z.enum([
          "gas",
          "water",
          "electricity",
          "heating",
          "internet",
          "common_cost",
          "other",
        ]),
        name: z.string().min(1),
        unit: z.string().min(1),
        serialNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [meter] = await ctx.db.insert(meters).values(input).returning();
      return meter;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        unit: z.string().min(1).optional(),
        serialNumber: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(meters).set(data).where(eq(meters.id, id));
    }),
});
