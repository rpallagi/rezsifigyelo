"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

const HU_MONTHS = [
  "jan",
  "feb",
  "már",
  "ápr",
  "máj",
  "jún",
  "júl",
  "aug",
  "sze",
  "okt",
  "nov",
  "dec",
] as const;

interface CommonFeeCalendarProps {
  commonFeeId: number;
  monthlyAmount: number;
  paymentsTracking: Array<{
    id: number;
    periodDate: string;
    paid: boolean;
    paidDate: string | null;
    amount: number | null;
  }>;
}

export function CommonFeeCalendar({
  commonFeeId,
  monthlyAmount,
  paymentsTracking,
}: CommonFeeCalendarProps) {
  const utils = api.useUtils();
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);

  const markPaid = api.commonFee.markPaid.useMutation({
    onSuccess: async () => {
      setPendingMonth(null);
      await Promise.all([
        utils.commonFee.list.invalidate(),
        utils.payment.listAll.invalidate(),
      ]);
    },
    onError: () => setPendingMonth(null),
  });

  const unmarkPaid = api.commonFee.unmarkPaid.useMutation({
    onSuccess: async () => {
      setPendingMonth(null);
      await Promise.all([
        utils.commonFee.list.invalidate(),
        utils.payment.listAll.invalidate(),
      ]);
    },
    onError: () => setPendingMonth(null),
  });

  // Build last 12 months including current
  const now = new Date();
  const months: { label: string; periodDate: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const periodDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    months.push({ label: HU_MONTHS[month]!, periodDate });
  }

  // Build a set of paid period dates for fast lookup
  const paidSet = new Set(
    paymentsTracking
      .filter((p) => p.paid)
      .map((p) => p.periodDate),
  );

  const handleClick = (periodDate: string, isPaid: boolean) => {
    if (pendingMonth) return; // prevent double-click
    setPendingMonth(periodDate);
    if (isPaid) {
      unmarkPaid.mutate({ commonFeeId, periodDate });
    } else {
      markPaid.mutate({ commonFeeId, periodDate, amount: monthlyAmount });
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {months.map(({ label, periodDate }) => {
        const isPaid = paidSet.has(periodDate);
        const isPending = pendingMonth === periodDate;

        return (
          <button
            key={periodDate}
            type="button"
            disabled={isPending}
            onClick={() => handleClick(periodDate, isPaid)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition ${
              isPending
                ? "opacity-50"
                : isPaid
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
            title={`${periodDate}${isPaid ? " (fizetve)" : ""}`}
          >
            {isPaid && (
              <svg
                className="mr-0.5 -ml-0.5 inline h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
