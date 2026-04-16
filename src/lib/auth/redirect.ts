import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export async function getSignedInRedirectPath(userId: string) {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { role: true },
  });

  // Default new users (no DB record yet) and tenants → /my-home
  // Only landlords get the management dashboard
  if (dbUser?.role === "landlord" || dbUser?.role === "admin") {
    return "/dashboard";
  }
  return "/my-home";
}
