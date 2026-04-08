import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import {
  landlordProfiles,
  properties,
  tariffGroups,
  tenancies,
} from "@/server/db/schema";
import type { db } from "@/server/db";
import type { users } from "@/server/db/schema";

type AuthedContext = {
  db: typeof db;
  dbUser: typeof users.$inferSelect;
};

export async function requireLandlordPropertyAccess(
  ctx: AuthedContext,
  propertyId: number,
) {
  const property = await ctx.db.query.properties.findFirst({
    where: and(
      eq(properties.id, propertyId),
      eq(properties.landlordId, ctx.dbUser.id),
    ),
  });

  if (!property) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Property access denied",
    });
  }

  return property;
}

export async function requireTariffGroupAccess(
  ctx: AuthedContext,
  tariffGroupId: number,
) {
  const tariffGroup = await ctx.db.query.tariffGroups.findFirst({
    where: and(
      eq(tariffGroups.id, tariffGroupId),
      eq(tariffGroups.landlordId, ctx.dbUser.id),
    ),
  });

  if (!tariffGroup) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tariff group access denied",
    });
  }

  return tariffGroup;
}

export async function requireLandlordProfileAccess(
  ctx: AuthedContext,
  landlordProfileId: number,
) {
  const profile = await ctx.db.query.landlordProfiles.findFirst({
    where: and(
      eq(landlordProfiles.id, landlordProfileId),
      eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
    ),
  });

  if (!profile) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Landlord profile access denied",
    });
  }

  return profile;
}

export async function getTenantActiveTenancy(ctx: AuthedContext) {
  const tenancy = await ctx.db.query.tenancies.findFirst({
    where: and(
      eq(tenancies.tenantId, ctx.dbUser.id),
      eq(tenancies.active, true),
    ),
    with: { property: true },
  });

  if (!tenancy) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active tenancy found",
    });
  }

  return tenancy;
}

export async function requirePropertyAccess(
  ctx: AuthedContext,
  propertyId: number,
) {
  if (ctx.dbUser.role === "landlord") {
    return requireLandlordPropertyAccess(ctx, propertyId);
  }

  if (ctx.dbUser.role === "tenant") {
    const tenancy = await getTenantActiveTenancy(ctx);
    if (tenancy.propertyId !== propertyId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Property access denied",
      });
    }

    return tenancy.property;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Unsupported role for property access",
  });
}

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}
