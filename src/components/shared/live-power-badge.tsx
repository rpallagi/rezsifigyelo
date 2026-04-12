"use client";

import { api } from "@/trpc/react";

interface LivePowerBadgeProps {
  deviceId: string;
  initialPower?: number | null;
  initialTimestamp?: string | null;
}

export function LivePowerBadge({ deviceId, initialPower }: LivePowerBadgeProps) {
  const { data, isFetching } = api.shellyCloud.getLivePower.useQuery(
    { deviceId },
    {
      refetchInterval: 5000, // poll every 5 seconds
      refetchIntervalInBackground: false,
      staleTime: 0,
    },
  );

  const power = data?.totalPower ?? initialPower ?? null;
  const timestamp = data?.timestamp ?? null;

  if (power == null) {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-secondary px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        <span className="text-xs font-medium text-muted-foreground">Offline</span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-950/30">
      <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${isFetching ? "animate-pulse" : ""}`} />
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
        Élő: {Math.round(power).toLocaleString("hu-HU")} W
      </span>
      {timestamp && (
        <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
          · {new Date(timestamp).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );
}
