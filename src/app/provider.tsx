"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { enUS, huHU } from "@clerk/localizations";
import { ThemeProvider } from "next-themes";

import { LocaleProvider } from "@/components/providers/locale-provider";
import { type Locale } from "@/lib/i18n/messages";

export function AuthProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={{}}
      localization={initialLocale === "en" ? enUS : huHU}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
