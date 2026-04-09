"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { api } from "@/trpc/react";

export function MaintenanceDemoActions({
  propertyIds,
}: {
  propertyIds: number[];
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const seedDemo = api.maintenance.seedDemo.useMutation({
    onSuccess: async () => {
      await utils.maintenance.invalidate();
      router.refresh();
    },
  });

  return (
    <button
      type="button"
      onClick={() => seedDemo.mutate({ propertyIds })}
      disabled={seedDemo.isPending || propertyIds.length === 0}
      className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <Sparkles className="h-4 w-4" />
      {seedDemo.isPending ? "Demó napló készül..." : "Demó bejegyzések feltöltése"}
    </button>
  );
}
