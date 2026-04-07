import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { requireLandlordPropertyAccess } from "@/server/api/access";
import { wifiNetworks } from "@/server/db/schema";

export const wifiRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.wifiNetworks.findMany({
        where: eq(wifiNetworks.propertyId, input.propertyId),
      });
    }),

  create: landlordProcedure
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
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const [wifi] = await ctx.db
        .insert(wifiNetworks)
        .values(input)
        .returning();
      return wifi;
    }),

  delete: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const wifi = await ctx.db.query.wifiNetworks.findFirst({
        where: eq(wifiNetworks.id, input.id),
      });

      if (!wifi) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "WiFi network not found",
        });
      }

      await requireLandlordPropertyAccess(ctx, wifi.propertyId);
      await ctx.db
        .delete(wifiNetworks)
        .where(eq(wifiNetworks.id, input.id));
    }),
});
