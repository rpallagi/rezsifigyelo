import { and, asc, eq, isNull } from "drizzle-orm";

import type { db } from "@/server/db";
import { landlordProfiles, properties } from "@/server/db/schema";
import type { users } from "@/server/db/schema";

function buildDefaultProfileName(user: typeof users.$inferSelect) {
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return fullName.length > 0 ? fullName : user.email;
}

export async function ensureDefaultLandlordProfile(
  database: typeof db,
  dbUser: typeof users.$inferSelect,
) {
  if (dbUser.role !== "landlord") {
    return null;
  }

  const existingProfiles = await database.query.landlordProfiles.findMany({
    where: eq(landlordProfiles.ownerUserId, dbUser.id),
    orderBy: [asc(landlordProfiles.createdAt)],
  });

  let defaultProfile = existingProfiles.find((profile) => profile.isDefault) ?? null;

  if (!defaultProfile && existingProfiles.length > 0) {
    const [updatedProfile] = await database
      .update(landlordProfiles)
      .set({ isDefault: true })
      .where(eq(landlordProfiles.id, existingProfiles[0]!.id))
      .returning();

    defaultProfile = updatedProfile ?? null;
  }

  if (!defaultProfile) {
    const baseName = buildDefaultProfileName(dbUser);
    const [createdProfile] = await database
      .insert(landlordProfiles)
      .values({
        ownerUserId: dbUser.id,
        displayName: "Alapértelmezett kiállító",
        profileType: "individual",
        billingName: baseName,
        billingEmail: dbUser.email,
        defaultDueDays: 5,
        defaultVatCode: "TAM",
        isDefault: true,
      })
      .returning();

    defaultProfile = createdProfile ?? null;
  }

  if (!defaultProfile) {
    return null;
  }

  await database
    .update(properties)
    .set({ landlordProfileId: defaultProfile.id })
    .where(
      and(
        eq(properties.landlordId, dbUser.id),
        isNull(properties.landlordProfileId),
      ),
    );

  return defaultProfile;
}
