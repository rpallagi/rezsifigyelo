import { z } from "zod";
import { eq } from "drizzle-orm";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { users } from "@/server/db/schema";

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
});
