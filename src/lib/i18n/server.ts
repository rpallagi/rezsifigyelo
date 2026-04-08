import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getMessages, type Locale } from "@/lib/i18n/messages";

export const LOCALE_COOKIE_NAME = "rezsi-locale";

export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (cookieLocale === "en") {
    return "en";
  }

  if (cookieLocale === "hu") {
    return "hu";
  }

  return "hu";
});

export async function getCurrentMessages() {
  return getMessages(await getCurrentLocale());
}
