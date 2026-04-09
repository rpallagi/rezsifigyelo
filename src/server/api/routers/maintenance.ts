import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc, inArray, and } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { maintenanceLogs, properties } from "@/server/db/schema";
import { parseLandlordProfileScopeFromHeader } from "@/lib/landlord-profile-scope";

export const maintenanceRouter = createTRPCRouter({
  get: landlordProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const log = await ctx.db.query.maintenanceLogs.findFirst({
        where: eq(maintenanceLogs.id, input.id),
        with: { property: true },
      });
      if (!log?.propertyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Maintenance log not found" });
      }
      await requireLandlordPropertyAccess(ctx, log.propertyId);
      return log;
    }),

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

      const scopeProfileIds = parseLandlordProfileScopeFromHeader(
        ctx.headers.get("cookie"),
      );
      const ownedProperties = await ctx.db.query.properties.findMany({
        columns: { id: true },
        where: scopeProfileIds
          ? and(
              eq(properties.landlordId, ctx.dbUser.id),
              inArray(properties.landlordProfileId, scopeProfileIds),
            )
          : eq(properties.landlordId, ctx.dbUser.id),
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
        priority: z.enum(["low", "normal", "urgent"]).default("normal"),
        performedBy: z.string().optional(),
        performedDate: z.string().optional(),
        photoUrls: z.array(z.string()).optional(),
        documentUrls: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [log] = await ctx.db
        .insert(maintenanceLogs)
        .values({
          propertyId: input.propertyId,
          description: input.description,
          category: input.category,
          costHuf: input.costHuf,
          priority: input.priority,
          status: input.performedDate ? "done" : "pending",
          performedBy: input.performedBy,
          performedDate: input.performedDate,
          photoUrls: input.photoUrls ?? [],
          documentUrls: input.documentUrls ?? [],
        })
        .returning();
      return log;
    }),

  update: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string().min(1).optional(),
        category: z.string().optional(),
        costHuf: z.number().optional(),
        priority: z.enum(["low", "normal", "urgent"]).optional(),
        status: z.enum(["pending", "in_progress", "done"]).optional(),
        performedBy: z.string().optional(),
        performedDate: z.string().optional(),
        photoUrls: z.array(z.string()).optional(),
        documentUrls: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db.query.maintenanceLogs.findFirst({
        where: eq(maintenanceLogs.id, input.id),
      });
      if (!log?.propertyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Maintenance log not found" });
      }
      await requireLandlordPropertyAccess(ctx, log.propertyId);

      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(maintenanceLogs)
        .set(data)
        .where(eq(maintenanceLogs.id, id))
        .returning();
      return updated;
    }),

  markCompleted: landlordProcedure
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

      const [updated] = await ctx.db
        .update(maintenanceLogs)
        .set({
          status: "done",
          performedDate:
            log.performedDate ?? new Date().toISOString().slice(0, 10),
        })
        .where(eq(maintenanceLogs.id, input.id))
        .returning();

      return updated;
    }),

  markInProgress: landlordProcedure
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

      const [updated] = await ctx.db
        .update(maintenanceLogs)
        .set({ status: "in_progress" })
        .where(eq(maintenanceLogs.id, input.id))
        .returning();

      return updated;
    }),

  seedDemo: landlordProcedure
    .input(z.object({ propertyIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      for (const propertyId of input.propertyIds) {
        await requireLandlordPropertyAccess(ctx, propertyId);
      }

      const sampleDates = [3, 8, 15, null] as const;
      const propertyIds = input.propertyIds;
      const samples = [
        {
          description: "Csőtörés elhárítása - Fürdőszoba",
          category: "vízszerelés",
          costHuf: 45000,
          performedBy: "Víz-Gáz Kft.",
        },
        {
          description: "Klímaberendezés éves tisztítása",
          category: "karbantartás",
          costHuf: 18000,
          performedBy: "Klíma-Master",
        },
        {
          description: "Konyhabútor csere és festés",
          category: "felújítás",
          costHuf: 850000,
          performedBy: "HomeDesign Stúdió",
        },
        {
          description: "Kismegszakító tábla korszerűsítése",
          category: "csere",
          costHuf: 62000,
          performedBy: "Watt-Vill Kft.",
        },
      ];

      const values = samples.map((sample, index) => {
        const daysAgo = sampleDates[index] ?? null;
        const performedDate =
          daysAgo == null
            ? null
            : new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);

        return {
          propertyId: propertyIds[index % propertyIds.length]!,
          description: sample.description,
          category: sample.category,
          costHuf: sample.costHuf,
          performedBy: sample.performedBy,
          performedDate,
        };
      });

      return ctx.db.insert(maintenanceLogs).values(values).returning();
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
