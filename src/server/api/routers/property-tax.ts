import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { propertyTaxes } from "@/server/db/schema";

export const propertyTaxRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.propertyTaxes.findMany({
        where: eq(propertyTaxes.propertyId, input.propertyId),
        orderBy: [desc(propertyTaxes.year)],
      });
    }),

  create: landlordProcedure
    .input(
      z.object({
        propertyId: z.number(),
        year: z.number(),
        annualAmount: z.number(),
        installmentAmount: z.number().optional(),
        bankAccount: z.string().optional(),
        recipient: z.string().optional(),
        paymentMemo: z.string().optional(),
        deadlineAutumn: z.string().optional(),
        deadlineSpring: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [tax] = await ctx.db
        .insert(propertyTaxes)
        .values(input)
        .returning();
      return tax;
    }),

  markPaid: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        period: z.enum(["autumn", "spring"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const propertyTax = await ctx.db.query.propertyTaxes.findFirst({
        where: eq(propertyTaxes.id, input.id),
      });

      if (!propertyTax) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property tax not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, propertyTax.propertyId);
      const today = new Date().toISOString().split("T")[0]!;
      if (input.period === "autumn") {
        await ctx.db
          .update(propertyTaxes)
          .set({ autumnPaid: true, autumnPaidDate: today })
          .where(eq(propertyTaxes.id, input.id));
      } else {
        await ctx.db
          .update(propertyTaxes)
          .set({ springPaid: true, springPaidDate: today })
          .where(eq(propertyTaxes.id, input.id));
      }
    }),
});
