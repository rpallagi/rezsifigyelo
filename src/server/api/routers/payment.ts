import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { payments, properties } from "@/server/db/schema";

export const paymentRouter = createTRPCRouter({
  listAll: landlordProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: payments.id,
        propertyId: payments.propertyId,
        propertyName: properties.name,
        amountHuf: payments.amountHuf,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
      })
      .from(payments)
      .innerJoin(properties, eq(payments.propertyId, properties.id))
      .where(
        and(
          eq(properties.landlordId, ctx.dbUser.id),
          eq(properties.archived, false),
        ),
      )
      .orderBy(desc(payments.paymentDate), desc(payments.id));
  }),

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
