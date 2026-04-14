"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, TrendingUp } from "lucide-react";

export default function InflationPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [adjustmentType, setAdjustmentType] = useState<"inflation_estimate" | "inflation_final">("inflation_estimate");
  const [percentage, setPercentage] = useState("");
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState(false);

  const { data: eligibleProperties } = api.rentAdjustment.eligibleProperties.useQuery();
  const { data: existingAdjustments } = api.rentAdjustment.list.useQuery({ year });
  const applyBatch = api.rentAdjustment.applyBatch.useMutation({
    onSuccess: () => setApplied(true),
  });

  const pct = Number(percentage) || 0;
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (!eligibleProperties) return;
    setSelectedIds(new Set(eligibleProperties.map((p) => p.id)));
  };

  // Generate default note based on type
  const prevYear = year - 1;
  const defaultNote = adjustmentType === "inflation_estimate"
    ? `A ${year}. januári bérleti díj megállapítása a bérleti szerződés inflációkövető záradéka alapján, ${percentage || "..."}%-os becsült éves indexszel történt. Mivel a KSH a végleges ${prevYear}. évi átlagos fogyasztóiár-indexet várhatóan január közepén teszi közzé, az esetleges eltérést a februári számlán korrigáljuk.`
    : `A ${year}. februári számla a bérleti szerződés inflációkövető záradéka alapján a KSH által közzétett végleges ${prevYear}. évi átlagos fogyasztóiár-index (${percentage || "..."}%) figyelembevételével került kiállításra.`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="rounded-full p-2 transition hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Inflációkövetés</h1>
          <p className="text-sm text-muted-foreground">
            Éves bérleti díj emelés a szerződés inflációkövető záradéka alapján
          </p>
        </div>
      </div>

      {applied ? (
        <div className="mt-8 rounded-2xl border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/20 p-6 text-center">
          <Check className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-3 text-lg font-semibold">Emelés alkalmazva!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {applyBatch.data?.applied} ingatlan bérleti díja frissítve {percentage}%-kal.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => { setApplied(false); setSelectedIds(new Set()); }} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">
              Újabb emelés
            </button>
            <Link href="/billing" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Számlázás
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Parameters */}
          <div className="rounded-2xl border border-border p-5 space-y-4">
            <h2 className="font-semibold">Paraméterek</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Év</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Típus</label>
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("inflation_estimate")}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      adjustmentType === "inflation_estimate" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
                    }`}
                  >
                    Becsült (Jan.)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("inflation_final")}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      adjustmentType === "inflation_final" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
                    }`}
                  >
                    Végleges (Feb.)
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Infláció (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="pl. 4.4"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Note template */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Számla megjegyzés sablon</label>
              <textarea
                value={note || defaultNote}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Property selection */}
          <div className="rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Ingatlanok kijelölése</h2>
              <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">
                Összes kijelölése
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Csak azok az ingatlanok jelennek meg ahol a bérlőnél be van kapcsolva az inflációkövetés.
            </p>

            {!eligibleProperties || eligibleProperties.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nincs inflációkövető bérleti szerződés. A bérlő szerkesztésénél kapcsold be az "Inflációkövetés" opciót.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 w-8"></th>
                      <th className="pb-2 font-medium">Ingatlan</th>
                      <th className="pb-2 font-medium">Bérlő</th>
                      <th className="pb-2 font-medium">Jelenlegi díj</th>
                      <th className="pb-2 font-medium">Emelt díj</th>
                      <th className="pb-2 font-medium">Különbözet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleProperties.map((p) => {
                      const currentRent = p.monthlyRent ?? 0;
                      const newRent = Math.round(currentRent * (1 + pct / 100));
                      const diff = newRent - currentRent;
                      const existing = existingAdjustments?.find((a) => a.propertyId === p.id);
                      return (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleSelect(p.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-2">
                            <p className="font-medium">{p.name}</p>
                            {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{p.tenantName ?? "—"}</td>
                          <td className="py-2 font-mono">{currentRent.toLocaleString("hu-HU")} {p.rentCurrency === "EUR" ? "€" : "Ft"}</td>
                          <td className="py-2 font-mono font-medium text-primary">
                            {pct > 0 ? `${newRent.toLocaleString("hu-HU")} Ft` : "—"}
                          </td>
                          <td className="py-2 font-mono text-xs">
                            {pct > 0 ? `+${diff.toLocaleString("hu-HU")} Ft` : "—"}
                            {existing && (
                              <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] text-amber-700">
                                {existing.adjustmentType === "inflation_estimate" ? "Becsült" : "Végleges"}: {existing.percentage}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Apply button */}
          <button
            type="button"
            disabled={selectedIds.size === 0 || !pct || applyBatch.isPending}
            onClick={() =>
              applyBatch.mutate({
                year,
                adjustmentType,
                percentage: pct,
                propertyIds: [...selectedIds],
                note: note || defaultNote,
              })
            }
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            {applyBatch.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {adjustmentType === "inflation_estimate" ? "Becsült emelés alkalmazása" : "Végleges emelés alkalmazása"} ({selectedIds.size} ingatlan)
          </button>

          {applyBatch.isError && (
            <p className="text-center text-sm text-destructive">{applyBatch.error.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
