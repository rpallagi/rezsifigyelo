import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { propertyTaxes } from "@/server/db/schema";

export const propertyTaxRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.propertyTaxes.findMany({
        where: eq(propertyTaxes.propertyId, input.propertyId),
        orderBy: [desc(propertyTaxes.year)],
      });
    }),

  create: protectedProcedure
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
      const [tax] = await ctx.db
        .insert(propertyTaxes)
        .values(input)
        .returning();
      return tax;
    }),

  markPaid: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        period: z.enum(["autumn", "spring"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
