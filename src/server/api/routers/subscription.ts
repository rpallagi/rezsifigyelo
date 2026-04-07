import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { subscriptions } from "@/server/db/schema";

export const subscriptionRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.dbUser.id),
    });
  }),
});
