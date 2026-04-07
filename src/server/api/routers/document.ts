import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { documents } from "@/server/db/schema";

export const documentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.documents.findMany({
        where: eq(documents.propertyId, input.propertyId),
        orderBy: [desc(documents.uploadedAt)],
      });
    }),

  create: protectedProcedure
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
      const [doc] = await ctx.db
        .insert(documents)
        .values(input)
        .returning();
      return doc;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(documents).where(eq(documents.id, input.id));
    }),
});
