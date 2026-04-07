import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { wifiNetworks } from "@/server/db/schema";

export const wifiRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.wifiNetworks.findMany({
        where: eq(wifiNetworks.propertyId, input.propertyId),
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        ssid: z.string().min(1),
        password: z.string().optional(),
        securityType: z.string().default("WPA2"),
        location: z.string().optional(),
        isPrimary: z.boolean().default(false),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [wifi] = await ctx.db
        .insert(wifiNetworks)
        .values(input)
        .returning();
      return wifi;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(wifiNetworks)
        .where(eq(wifiNetworks.id, input.id));
    }),
});
