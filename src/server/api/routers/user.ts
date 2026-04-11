import { z } from "zod";
import { eq } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { users, appSettings } from "@/server/db/schema";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.dbUser;
  }),

  updateLocale: protectedProcedure
    .input(z.object({ locale: z.enum(["hu", "en"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ locale: input.locale })
        .where(eq(users.id, ctx.dbUser.id));
    }),

  updateTheme: protectedProcedure
    .input(z.object({ theme: z.enum(["light", "dark", "system"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ theme: input.theme })
        .where(eq(users.id, ctx.dbUser.id));
    }),

  getEurRate: protectedProcedure.query(async ({ ctx }) => {
    const key = `eur_huf_rate:${ctx.dbUser.id}`;
    const setting = await ctx.db.query.appSettings.findFirst({
      where: eq(appSettings.key, key),
    });
    return setting?.value ? Number(setting.value) : 410;
  }),

  setEurRate: protectedProcedure
    .input(z.object({ rate: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const key = `eur_huf_rate:${ctx.dbUser.id}`;
      await ctx.db
        .insert(appSettings)
        .values({ key, value: String(input.rate) })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: String(input.rate) },
        });
      return { success: true };
    }),
});
