"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";
import { ThemeProvider } from "next-themes";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      ui={ui}
      appearance={{}}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </ClerkProvider>
  );
}
