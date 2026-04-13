"use client";

import { api } from "@/trpc/react";

export function VirtualMeterConsumption({ meterId }: { meterId: number }) {
  const { data, isLoading } = api.meter.virtualConsumption.useQuery({ meterId });

  if (isLoading) {
    return (
      <div className="mt-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 px-2 py-1.5 text-[11px] animate-pulse">
        <div className="h-4 bg-purple-100 dark:bg-purple-900/30 rounded w-24" />
      </div>
    );
  }

  if (!data || data.latestCalculated === null) {
    return (
      <div className="mt-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 px-2 py-1.5 text-[11px] text-muted-foreground">
        Nincs elég adat a számításhoz
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 px-2 py-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-purple-600 dark:text-purple-400">Számított:</span>
        <span className="font-bold tabular-nums text-purple-700 dark:text-purple-300">
          {data.latestCalculated.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} kWh
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        = Főmérő ({data.latestPrimary?.toLocaleString("hu-HU", { maximumFractionDigits: 1 })})
        {data.subtractNames.map((name, i) => (
          <span key={i}> - {name} ({(data.months[0]?.subtractConsumption ?? 0).toLocaleString("hu-HU", { maximumFractionDigits: 1 })})</span>
        ))}
      </p>
      {data.months.length > 1 && (
        <div className="mt-1.5 space-y-0.5">
          {data.months.slice(0, 6).map((m) => (
            <div key={m.readingDate} className="flex items-center justify-between text-[9px] text-muted-foreground/70">
              <span>{m.readingDate}</span>
              <span className="tabular-nums">{m.calculatedConsumption.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} kWh</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
