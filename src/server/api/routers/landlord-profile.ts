import { and, asc, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { landlordProfiles, properties } from "@/server/db/schema";
import { ensureDefaultLandlordProfile } from "@/server/landlord-profiles/service";

const PROFILE_COLORS = ["blue", "emerald", "purple", "amber", "rose", "sky", "orange", "slate"] as const;

const landlordProfileInput = z.object({
  displayName: z.string().min(1),
  profileType: z.enum(["individual", "company", "co_ownership"]),
  billingName: z.string().min(1),
  billingEmail: z.string().email().optional().or(z.literal("")),
  billingAddress: z.string().optional(),
  taxNumber: z.string().optional(),
  color: z.enum(PROFILE_COLORS).optional(),
  agentKey: z.string().optional(),
  eInvoice: z.boolean().default(true),
  defaultDueDays: z.number().int().min(0).max(31).default(5),
  defaultVatCode: z.enum(["TAM", "AAM", "27"]).default("TAM"),
  isDefault: z.boolean().default(false),
});

export const landlordProfileRouter = createTRPCRouter({
  list: landlordProcedure.query(async ({ ctx }) => {
    const profiles = await ctx.db.query.landlordProfiles.findMany({
      where: eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
      orderBy: [asc(landlordProfiles.displayName)],
      with: {
        properties: true,
      },
    });

    return profiles.map((profile) => ({
      ...profile,
      configured: !!profile.agentKey,
      propertyCount: profile.properties.length,
    }));
  }),

  count: landlordProcedure.query(async ({ ctx }) => {
    const profiles = await ctx.db.query.landlordProfiles.findMany({
      where: eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
      columns: { id: true },
    });

    return profiles.length;
  }),

  getDefault: landlordProcedure.query(async ({ ctx }) => {
    const profile = await ensureDefaultLandlordProfile(ctx.db, ctx.dbUser);
    return profile;
  }),

  create: landlordProcedure.input(landlordProfileInput).mutation(async ({ ctx, input }) => {
    if (input.isDefault) {
      await ctx.db
        .update(landlordProfiles)
        .set({ isDefault: false })
        .where(eq(landlordProfiles.ownerUserId, ctx.dbUser.id));
    }

    const [profile] = await ctx.db
      .insert(landlordProfiles)
      .values({
        ownerUserId: ctx.dbUser.id,
        displayName: input.displayName,
        profileType: input.profileType,
        billingName: input.billingName,
        billingEmail: input.billingEmail ?? null,
        billingAddress: input.billingAddress ?? null,
        taxNumber: input.taxNumber ?? null,
        color: input.color ?? null,
        agentKey: input.agentKey ?? null,
        eInvoice: input.eInvoice,
        defaultDueDays: input.defaultDueDays,
        defaultVatCode: input.defaultVatCode,
        isDefault: input.isDefault,
      })
      .returning();

    return profile;
  }),

  update: landlordProcedure
    .input(landlordProfileInput.extend({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.landlordProfiles.findFirst({
        where: and(
          eq(landlordProfiles.id, input.id),
          eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Landlord profile not found",
        });
      }

      if (input.isDefault) {
        await ctx.db
          .update(landlordProfiles)
          .set({ isDefault: false })
          .where(
            and(
              eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
              ne(landlordProfiles.id, input.id),
            ),
          );
      }

      const [profile] = await ctx.db
        .update(landlordProfiles)
        .set({
          displayName: input.displayName,
          profileType: input.profileType,
          billingName: input.billingName,
          billingEmail: input.billingEmail ?? null,
          billingAddress: input.billingAddress ?? null,
          taxNumber: input.taxNumber ?? null,
          color: input.color ?? null,
          agentKey: input.agentKey ?? null,
          eInvoice: input.eInvoice,
          defaultDueDays: input.defaultDueDays,
          defaultVatCode: input.defaultVatCode,
          isDefault: input.isDefault,
        })
        .where(eq(landlordProfiles.id, input.id))
        .returning();

      return profile;
    }),

  remove: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.query.landlordProfiles.findFirst({
        where: and(
          eq(landlordProfiles.id, input.id),
          eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
        ),
        with: {
          properties: true,
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Landlord profile not found",
        });
      }

      if (profile.isDefault) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Az alapértelmezett profilt nem törölheted",
        });
      }

      if (profile.properties.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ehhez a profilhoz még ingatlanok vannak rendelve",
        });
      }

      await ctx.db.delete(landlordProfiles).where(eq(landlordProfiles.id, input.id));

      return { success: true };
    }),

  assignToProperty: landlordProcedure
    .input(
      z.object({
        propertyId: z.number(),
        landlordProfileId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.query.landlordProfiles.findFirst({
        where: and(
          eq(landlordProfiles.id, input.landlordProfileId),
          eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
        ),
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Landlord profile not found",
        });
      }

      await ctx.db
        .update(properties)
        .set({ landlordProfileId: input.landlordProfileId })
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.landlordId, ctx.dbUser.id),
          ),
        );

      return { success: true };
    }),
});
