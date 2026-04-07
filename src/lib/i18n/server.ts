import "server-only";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import {
  getMessages,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/messages";

export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const { userId } = await auth();

  if (!userId) {
    return "hu";
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { locale: true },
  });

  return normalizeLocale(user?.locale);
});

export async function getCurrentMessages() {
  return getMessages(await getCurrentLocale());
}
