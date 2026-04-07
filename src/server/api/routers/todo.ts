import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { todos } from "@/server/db/schema";

export const todoRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.todos.findMany({
      where: eq(todos.landlordId, ctx.dbUser.id),
      with: { property: true },
      orderBy: [desc(todos.createdAt)],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [todo] = await ctx.db
        .insert(todos)
        .values({ landlordId: ctx.dbUser.id, ...input })
        .returning();
      return todo;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["pending", "in_progress", "done"]).optional(),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.status === "done") {
        updateData.completedAt = new Date();
      }
      await ctx.db
        .update(todos)
        .set(updateData)
        .where(and(eq(todos.id, id), eq(todos.landlordId, ctx.dbUser.id)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(todos)
        .where(and(eq(todos.id, input.id), eq(todos.landlordId, ctx.dbUser.id)));
    }),
});
