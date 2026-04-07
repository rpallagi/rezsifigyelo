import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { documents } from "@/server/db/schema";

export const documentRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.documents.findMany({
        where: eq(documents.propertyId, input.propertyId),
        orderBy: [desc(documents.uploadedAt)],
      });
    }),

  create: landlordProcedure
    .input(
      z.object({
        propertyId: z.number(),
        filename: z.string(),
        storedUrl: z.string(),
        category: z
          .enum(["atadas_atvetel", "szerzodes", "marketing", "egyeb"])
          .default("egyeb"),
        notes: z.string().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [doc] = await ctx.db
        .insert(documents)
        .values(input)
        .returning();
      return doc;
    }),

  delete: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.db.query.documents.findFirst({
        where: eq(documents.id, input.id),
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, document.propertyId);
      await ctx.db.delete(documents).where(eq(documents.id, input.id));
    }),
});
