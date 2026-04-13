"use client";

import { api } from "@/trpc/react";

function formatCurrency(value?: number | null) {
  return value != null ? `${Math.round(value).toLocaleString("hu-HU")} Ft` : "—";
}

/**
 * Replaces the consumption + cost display for a virtual meter reading.
 * Shows the calculated value (primary - subtract) instead of the raw P1 value.
 */
export function VirtualConsumptionCell({
  meterId,
  readingDate,
  costPerUnit,
  fallbackConsumption,
  fallbackCost,
}: {
  meterId: number;
  readingDate: string;
  costPerUnit: number | null;
  fallbackConsumption: number | null;
  fallbackCost: number | null;
}) {
  const { data, isLoading } = api.meter.virtualConsumption.useQuery({ meterId });

  if (isLoading || !data) {
    // Show original values while loading
    return (
      <>
        <td className="py-3">{fallbackConsumption ?? "—"}</td>
        <td className="py-3">{formatCurrency(fallbackCost)}</td>
      </>
    );
  }

  const month = data.months.find((m) => m.readingDate === readingDate);
  if (!month) {
    return (
      <>
        <td className="py-3">{fallbackConsumption ?? "—"}</td>
        <td className="py-3">{formatCurrency(fallbackCost)}</td>
      </>
    );
  }

  const calc = month.calculatedConsumption;
  const calcCost = costPerUnit ? calc * costPerUnit : null;

  return (
    <>
      <td className="py-3">
        <span className="font-medium text-purple-700 dark:text-purple-300">
          {calc.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} kWh
        </span>
        <span className="ml-1 text-[10px] text-muted-foreground">
          (P1: {(fallbackConsumption ?? 0).toLocaleString("hu-HU", { maximumFractionDigits: 1 })})
        </span>
      </td>
      <td className="py-3">
        <span className="font-medium text-purple-700 dark:text-purple-300">
          {formatCurrency(calcCost)}
        </span>
      </td>
    </>
  );
}

/**
 * Mobile card version — shows calculated consumption inline.
 */
export function VirtualConsumptionMobile({
  meterId,
  readingDate,
  costPerUnit,
  fallbackConsumption,
  fallbackCost,
}: {
  meterId: number;
  readingDate: string;
  costPerUnit: number | null;
  fallbackConsumption: number | null;
  fallbackCost: number | null;
}) {
  const { data } = api.meter.virtualConsumption.useQuery({ meterId });

  const month = data?.months.find((m) => m.readingDate === readingDate);
  const calc = month?.calculatedConsumption;
  const calcCost = calc != null && costPerUnit ? calc * costPerUnit : null;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="text-muted-foreground">Fogyasztás</p>
        {calc != null ? (
          <p className="mt-1 font-medium text-purple-700 dark:text-purple-300">
            {calc.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} kWh
            <span className="ml-1 text-[10px] text-muted-foreground font-normal">
              (P1: {(fallbackConsumption ?? 0).toLocaleString("hu-HU", { maximumFractionDigits: 1 })})
            </span>
          </p>
        ) : (
          <p className="mt-1 font-medium">{fallbackConsumption ?? "—"}</p>
        )}
      </div>
      <div>
        <p className="text-muted-foreground">Költség</p>
        <p className={`mt-1 font-medium ${calc != null ? "text-purple-700 dark:text-purple-300" : ""}`}>
          {formatCurrency(calcCost ?? fallbackCost)}
        </p>
      </div>
    </div>
  );
}
