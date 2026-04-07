import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { maintenanceLogs } from "@/server/db/schema";

export const maintenanceRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.propertyId) {
        return ctx.db.query.maintenanceLogs.findMany({
          where: eq(maintenanceLogs.propertyId, input.propertyId),
          orderBy: [desc(maintenanceLogs.createdAt)],
        });
      }
      return ctx.db.query.maintenanceLogs.findMany({
        orderBy: [desc(maintenanceLogs.createdAt)],
        with: { property: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.number().optional(),
        description: z.string().min(1),
        category: z.string().optional(),
        costHuf: z.number().optional(),
        performedBy: z.string().optional(),
        performedDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [log] = await ctx.db
        .insert(maintenanceLogs)
        .values(input)
        .returning();
      return log;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(maintenanceLogs)
        .where(eq(maintenanceLogs.id, input.id));
    }),
});
