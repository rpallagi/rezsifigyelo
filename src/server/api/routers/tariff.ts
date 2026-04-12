import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireTariffGroupAccess } from "@/server/api/access";
import { tariffs, tariffGroups } from "@/server/db/schema";

export const tariffRouter = createTRPCRouter({
  listGroups: landlordProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tariffGroups.findMany({
      where: eq(tariffGroups.landlordId, ctx.dbUser.id),
      with: { tariffs: { orderBy: [desc(tariffs.validFrom)] } },
    });
  }),

  getGroup: landlordProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireTariffGroupAccess(ctx, input.id);

      return ctx.db.query.tariffGroups.findFirst({
        where: eq(tariffGroups.id, input.id),
        with: { tariffs: { orderBy: [desc(tariffs.validFrom)] } },
      });
    }),

  createGroup: landlordProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [group] = await ctx.db
        .insert(tariffGroups)
        .values({ landlordId: ctx.dbUser.id, ...input })
        .returning();
      return group;
    }),

  updateGroup: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTariffGroupAccess(ctx, input.id);

      const { id, ...data } = input;

      const [group] = await ctx.db
        .update(tariffGroups)
        .set(data)
        .where(eq(tariffGroups.id, id))
        .returning();

      return group;
    }),

  createTariff: landlordProcedure
    .input(
      z.object({
        tariffGroupId: z.number(),
        utilityType: z.enum([
          "villany",
          "viz",
          "gaz",
          "csatorna",
          "internet",
          "kozos_koltseg",
          "egyeb",
        ]),
        rateHuf: z.number(),
        unit: z.string().min(1),
        validFrom: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTariffGroupAccess(ctx, input.tariffGroupId);

      const [tariff] = await ctx.db
        .insert(tariffs)
        .values(input)
        .returning();
      return tariff;
    }),

  updateTariff: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        utilityType: z.enum([
          "villany",
          "viz",
          "gaz",
          "csatorna",
          "internet",
          "kozos_koltseg",
          "egyeb",
        ]).optional(),
        rateHuf: z.number().optional(),
        unit: z.string().min(1).optional(),
        validFrom: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tariff = await ctx.db.query.tariffs.findFirst({
        where: eq(tariffs.id, input.id),
      });
      if (!tariff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tarifa nem található" });
      }
      await requireTariffGroupAccess(ctx, tariff.tariffGroupId);

      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(tariffs)
        .set(data)
        .where(eq(tariffs.id, id))
        .returning();
      return updated;
    }),

  deleteTariff: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tariff = await ctx.db.query.tariffs.findFirst({
        where: eq(tariffs.id, input.id),
      });
      if (!tariff) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tarifa nem található" });
      }
      await requireTariffGroupAccess(ctx, tariff.tariffGroupId);

      await ctx.db.delete(tariffs).where(eq(tariffs.id, input.id));
      return { success: true };
    }),

  deleteGroup: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireTariffGroupAccess(ctx, input.id);

      // Unlink any properties first (set tariffGroupId to null)
      const { properties } = await import("@/server/db/schema");
      await ctx.db
        .update(properties)
        .set({ tariffGroupId: null })
        .where(eq(properties.tariffGroupId, input.id));

      // Delete all tariffs in this group
      await ctx.db.delete(tariffs).where(eq(tariffs.tariffGroupId, input.id));

      // Delete the group
      await ctx.db.delete(tariffGroups).where(eq(tariffGroups.id, input.id));
      return { success: true };
    }),
});
