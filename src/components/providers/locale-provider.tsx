"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  getMessages,
  getUtilityLabel,
  type Locale,
  type Messages,
  toIntlLocale,
} from "@/lib/i18n/messages";

const LOCALE_COOKIE_NAME = "rezsi-locale";

type LocaleContextValue = {
  locale: Locale;
  intlLocale: string;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  utilityLabel: (utilityType: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      intlLocale: toIntlLocale(locale),
      messages: getMessages(locale),
      setLocale,
      utilityLabel: (utilityType: string) => getUtilityLabel(locale, utilityType),
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);

  if (!value) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return value;
}
