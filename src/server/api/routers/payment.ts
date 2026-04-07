import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { payments } from "@/server/db/schema";

export const paymentRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.payments.findMany({
        where: eq(payments.propertyId, input.propertyId),
        orderBy: [desc(payments.paymentDate)],
      });
    }),

  create: landlordProcedure
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
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [payment] = await ctx.db
        .insert(payments)
        .values(input)
        .returning();
      return payment;
    }),

  delete: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.query.payments.findFirst({
        where: eq(payments.id, input.id),
      });

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, payment.propertyId);
      await ctx.db.delete(payments).where(eq(payments.id, input.id));
    }),
});
