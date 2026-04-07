import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { commonFees, commonFeePayments } from "@/server/db/schema";

export const commonFeeRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.commonFees.findMany({
        where: eq(commonFees.propertyId, input.propertyId),
        with: { paymentsTracking: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        bankAccount: z.string().optional(),
        recipient: z.string().optional(),
        monthlyAmount: z.number(),
        paymentMemo: z.string().optional(),
        frequency: z.string().default("monthly"),
        paymentDay: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [fee] = await ctx.db
        .insert(commonFees)
        .values(input)
        .returning();
      return fee;
    }),

  markPaid: protectedProcedure
    .input(
      z.object({
        commonFeeId: z.number(),
        periodDate: z.string(),
        amount: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [payment] = await ctx.db
        .insert(commonFeePayments)
        .values({
          commonFeeId: input.commonFeeId,
          periodDate: input.periodDate,
          paid: true,
          paidDate: new Date().toISOString().split("T")[0]!,
          amount: input.amount,
        })
        .returning();
      return payment;
    }),
});
