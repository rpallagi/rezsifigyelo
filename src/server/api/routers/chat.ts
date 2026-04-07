import { z } from "zod";
import { eq, and, desc, ne } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { requirePropertyAccess } from "@/server/api/access";
import { chatMessages } from "@/server/db/schema";

export const chatRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      return ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.propertyId, input.propertyId),
        with: { sender: true },
        orderBy: [desc(chatMessages.createdAt)],
        limit: 100,
      });
    }),

  send: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      const senderType =
        ctx.dbUser.role === "tenant" ? "tenant" : "admin";

      const [msg] = await ctx.db
        .insert(chatMessages)
        .values({
          propertyId: input.propertyId,
          senderId: ctx.dbUser.id,
          senderType,
          message: input.message,
        })
        .returning();
      return msg;
    }),

  markRead: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      // Mark all messages in this property as read for current user
      await ctx.db
        .update(chatMessages)
        .set({ isRead: true })
        .where(
          and(
            eq(chatMessages.propertyId, input.propertyId),
            eq(chatMessages.isRead, false),
            ne(chatMessages.senderId, ctx.dbUser.id),
          ),
        );
    }),
});
