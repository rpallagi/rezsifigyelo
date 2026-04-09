import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { marketingContent } from "@/server/db/schema";

export const marketingRouter = createTRPCRouter({
  get: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const content = await ctx.db.query.marketingContent.findFirst({
        where: eq(marketingContent.propertyId, input.propertyId),
      });

      return content ?? null;
    }),

  upsert: landlordProcedure
    .input(
      z.object({
        propertyId: z.number(),
        listingTitle: z.string().optional(),
        listingDescription: z.string().optional(),
        listingUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const existing = await ctx.db.query.marketingContent.findFirst({
        where: eq(marketingContent.propertyId, input.propertyId),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(marketingContent)
          .set({
            listingTitle: input.listingTitle,
            listingDescription: input.listingDescription,
            listingUrl: input.listingUrl,
          })
          .where(eq(marketingContent.propertyId, input.propertyId))
          .returning();

        return updated;
      }

      const [created] = await ctx.db
        .insert(marketingContent)
        .values({
          propertyId: input.propertyId,
          listingTitle: input.listingTitle,
          listingDescription: input.listingDescription,
          listingUrl: input.listingUrl,
        })
        .returning();

      return created;
    }),
});
