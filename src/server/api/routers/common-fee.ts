import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { commonFees, commonFeePayments } from "@/server/db/schema";

export const commonFeeRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.commonFees.findMany({
        where: eq(commonFees.propertyId, input.propertyId),
        with: { paymentsTracking: true },
      });
    }),

  create: landlordProcedure
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
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [fee] = await ctx.db
        .insert(commonFees)
        .values(input)
        .returning();
      return fee;
    }),

  markPaid: landlordProcedure
    .input(
      z.object({
        commonFeeId: z.number(),
        periodDate: z.string(),
        amount: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const commonFee = await ctx.db.query.commonFees.findFirst({
        where: eq(commonFees.id, input.commonFeeId),
      });

      if (!commonFee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Common fee not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, commonFee.propertyId);
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
