"use client";

import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { api } from "@/trpc/react";

export function MaintenanceEntryActions({
  id,
  canComplete,
}: {
  id: number;
  canComplete: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const deleteLog = api.maintenance.delete.useMutation({
    onSuccess: async () => {
      await utils.maintenance.invalidate();
      router.refresh();
    },
  });

  const completeLog = api.maintenance.markCompleted.useMutation({
    onSuccess: async () => {
      await utils.maintenance.invalidate();
      router.refresh();
    },
  });

  return (
    <div className="flex items-center gap-2">
      {canComplete && (
        <button
          type="button"
          onClick={() => completeLog.mutate({ id })}
          disabled={completeLog.isPending || deleteLog.isPending}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
          aria-label="Készre jelölés"
          title="Készre jelölés"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => deleteLog.mutate({ id })}
        disabled={completeLog.isPending || deleteLog.isPending}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
        aria-label="Bejegyzés törlése"
        title="Bejegyzés törlése"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
