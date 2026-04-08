import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import {
  getMessages,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/messages";

export const LOCALE_COOKIE_NAME = "rezsi-locale";

export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieLocale = normalizeLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  );
  if (cookieLocale === "en") {
    return "en";
  }

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
