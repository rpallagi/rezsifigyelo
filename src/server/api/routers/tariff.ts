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
});
