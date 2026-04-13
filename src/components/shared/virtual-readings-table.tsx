"use client";

import { api } from "@/trpc/react";

function formatCurrency(value?: number | null) {
  return value != null ? `${Math.round(value).toLocaleString("hu-HU")} Ft` : "—";
}

export function VirtualReadingsNote({
  meterId,
  readingDate,
  originalConsumption,
  costPerUnit,
}: {
  meterId: number;
  readingDate: string;
  originalConsumption: number | null;
  costPerUnit: number | null;
}) {
  const { data } = api.meter.virtualConsumption.useQuery({ meterId });

  if (!data) return null;

  const month = data.months.find((m) => m.readingDate === readingDate);
  if (!month) return null;

  const calc = month.calculatedConsumption;
  const calcCost = costPerUnit ? calc * costPerUnit : null;

  return (
    <div className="mt-1 rounded bg-purple-50 dark:bg-purple-950/20 px-2 py-1 text-[10px] text-purple-700 dark:text-purple-300">
      Szamitott: <span className="font-bold">{calc.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} kWh</span>
      {calcCost != null && (
        <span className="ml-2">{formatCurrency(calcCost)}</span>
      )}
      <span className="ml-1 text-purple-500/70">
        (teljes: {(originalConsumption ?? 0).toLocaleString("hu-HU", { maximumFractionDigits: 1 })})
      </span>
    </div>
  );
}
