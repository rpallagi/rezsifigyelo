"use client";

import { useEffect } from "react";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
      <div className="rounded-[24px] border border-border/60 bg-card/90 p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight">
          Hiba történt
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Valami nem sikerült. Kérjük, próbáld újra.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Próbáld újra
        </button>
      </div>
    </div>
  );
}
