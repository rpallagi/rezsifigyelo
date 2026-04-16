"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <ClerkSignOutButton>
      <button
        type="button"
        title="Kijelentkezés"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </ClerkSignOutButton>
  );
}
