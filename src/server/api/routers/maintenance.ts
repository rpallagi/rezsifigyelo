import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, inArray } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { maintenanceLogs, properties } from "@/server/db/schema";

export const maintenanceRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.propertyId) {
        await requireLandlordPropertyAccess(ctx, input.propertyId);

        return ctx.db.query.maintenanceLogs.findMany({
          where: eq(maintenanceLogs.propertyId, input.propertyId),
          orderBy: [desc(maintenanceLogs.createdAt)],
        });
      }

      const ownedProperties = await ctx.db.query.properties.findMany({
        columns: { id: true },
        where: eq(properties.landlordId, ctx.dbUser.id),
      });
      const propertyIds = ownedProperties.map((property) => property.id);
      if (propertyIds.length === 0) {
        return [];
      }

      return ctx.db.query.maintenanceLogs.findMany({
        where: inArray(maintenanceLogs.propertyId, propertyIds),
        orderBy: [desc(maintenanceLogs.createdAt)],
        with: { property: true },
      });
    }),

  create: landlordProcedure
    .input(
      z.object({
        propertyId: z.number(),
        description: z.string().min(1),
        category: z.string().optional(),
        costHuf: z.number().optional(),
        performedBy: z.string().optional(),
        performedDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [log] = await ctx.db
        .insert(maintenanceLogs)
        .values(input)
        .returning();
      return log;
    }),

  delete: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db.query.maintenanceLogs.findFirst({
        where: eq(maintenanceLogs.id, input.id),
      });

      if (!log?.propertyId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance log not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, log.propertyId);
      await ctx.db
        .delete(maintenanceLogs)
        .where(eq(maintenanceLogs.id, input.id));
    }),
});
