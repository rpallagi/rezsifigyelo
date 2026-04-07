import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export async function getSignedInRedirectPath(userId: string) {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { role: true },
  });

  if (dbUser?.role === "tenant") {
    return "/my-home";
  }

  return "/dashboard";
}
