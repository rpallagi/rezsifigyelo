import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { payments } from "@/server/db/schema";

export const paymentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.payments.findMany({
        where: eq(payments.propertyId, input.propertyId),
        orderBy: [desc(payments.paymentDate)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        amountHuf: z.number(),
        paymentDate: z.string(),
        paymentMethod: z.string().optional(),
        periodFrom: z.string().optional(),
        periodTo: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [payment] = await ctx.db
        .insert(payments)
        .values(input)
        .returning();
      return payment;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(payments).where(eq(payments.id, input.id));
    }),
});
