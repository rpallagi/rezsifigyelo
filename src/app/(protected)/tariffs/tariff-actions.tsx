"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "@/trpc/react";

const UTILITY_TYPES = ["villany", "viz", "gaz", "csatorna", "internet", "kozos_koltseg", "egyeb"] as const;
type UtilityType = typeof UTILITY_TYPES[number];

interface Tariff {
  id: number;
  utilityType: string;
  rateHuf: number;
  unit: string;
  validFrom: string | Date;
}

export function TariffRowActions({ tariff }: { tariff: Tariff }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rateHuf, setRateHuf] = useState(String(tariff.rateHuf));
  const [unit, setUnit] = useState(tariff.unit);
  const [utilityType, setUtilityType] = useState<UtilityType>(tariff.utilityType as UtilityType);
  const [validFrom, setValidFrom] = useState(
    typeof tariff.validFrom === "string"
      ? tariff.validFrom.slice(0, 10)
      : new Date(tariff.validFrom).toISOString().slice(0, 10),
  );

  const update = api.tariff.updateTariff.useMutation({
    onSuccess: () => { setEditing(false); router.refresh(); },
  });

  const del = api.tariff.deleteTariff.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (editing) {
    return (
      <tr className="border-b bg-muted/30">
        <td className="py-2">
          <select
            value={utilityType}
            onChange={(e) => setUtilityType(e.target.value as UtilityType)}
            className="rounded border border-input bg-background px-2 py-1 text-xs"
          >
            {UTILITY_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </td>
        <td className="py-2">
          <input
            type="number"
            step="0.01"
            value={rateHuf}
            onChange={(e) => setRateHuf(e.target.value)}
            className="w-24 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </td>
        <td className="py-2">
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-xs"
          />
        </td>
        <td className="py-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => update.mutate({
                id: tariff.id,
                utilityType,
                rateHuf: Number(rateHuf),
                unit,
                validFrom,
              })}
              disabled={update.isPending}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
            >
              Mentés
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-border px-2 py-1 text-xs"
            >
              Mégse
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const dateStr = typeof tariff.validFrom === "string"
    ? tariff.validFrom.slice(0, 10)
    : new Date(tariff.validFrom).toISOString().slice(0, 10);

  return (
    <tr className="border-b">
      <td className="py-2 capitalize">{tariff.utilityType}</td>
      <td className="py-2">{tariff.rateHuf} Ft</td>
      <td className="py-2">{tariff.unit}</td>
      <td className="py-2">{dateStr}</td>
      <td className="py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border border-border px-2 py-0.5 text-xs hover:bg-secondary"
          >
            Szerk.
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Biztosan törlöd? (${tariff.utilityType} ${tariff.rateHuf} Ft)`)) {
                del.mutate({ id: tariff.id });
              }
            }}
            disabled={del.isPending}
            className="rounded border border-destructive/50 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Töröl
          </button>
        </div>
      </td>
    </tr>
  );
}

export function GroupDeleteButton({ groupId, name }: { groupId: number; name: string }) {
  const router = useRouter();
  const del = api.tariff.deleteGroup.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`Biztosan törlöd a "${name}" tarifa csoportot az összes tarifával együtt? Az ingatlanok leválasztódnak róla.`)) {
          del.mutate({ id: groupId });
        }
      }}
      disabled={del.isPending}
      className="rounded-md border border-destructive/50 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      Törlés
    </button>
  );
}

const PROVIDER_LABELS: Record<string, { name: string; icon: string }> = {
  claude: { name: "Claude", icon: "🟠" },
  gemini: { name: "Gemini", icon: "🔵" },
  openai: { name: "GPT", icon: "🟢" },
};

export function AiTariffRefresh({
  tariffGroupId,
  currentTariffs,
}: {
  tariffGroupId: number;
  currentTariffs: Tariff[];
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<"claude" | "gemini" | "openai">("claude");
  const [showPreview, setShowPreview] = useState(false);
  const { data: providers } = api.ai.availableProviders.useQuery();

  const research = api.ai.researchTariffs.useMutation();
  const apply = api.ai.applyTariffs.useMutation({
    onSuccess: () => {
      setShowPreview(false);
      router.refresh();
    },
  });

  const hasAnyProvider = providers && (providers.claude || providers.gemini || providers.openai);

  if (providers && !hasAnyProvider) {
    return (
      <Link
        href="/settings?section=ocr"
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100"
      >
        <Sparkles className="h-3 w-3" />
        AI frissítés — API kulcs szükséges
      </Link>
    );
  }

  const handleResearch = () => {
    research.mutate({ provider });
    setShowPreview(true);
  };

  const utilityLabels: Record<string, string> = {
    villany: "Villany", viz: "Víz", csatorna: "Csatorna", gaz: "Gáz",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Provider selector */}
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {(["claude", "gemini", "openai"] as const).map((p) => {
            const available = providers?.[p];
            const meta = PROVIDER_LABELS[p]!;
            return (
              <button
                key={p}
                type="button"
                disabled={!available}
                onClick={() => setProvider(p)}
                title={available ? meta.name : `${meta.name} — nincs API kulcs`}
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  provider === p && available
                    ? "bg-primary text-primary-foreground"
                    : available
                      ? "text-muted-foreground hover:bg-secondary"
                      : "text-muted-foreground/30 cursor-not-allowed"
                }`}
              >
                {meta.icon} {meta.name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleResearch}
          disabled={research.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {research.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          AI tarifa frissítés
        </button>
      </div>

      {research.isError && (
        <p className="text-xs text-destructive">{research.error.message}</p>
      )}

      {/* Preview results */}
      {showPreview && research.data && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">AI kutatás eredménye ({PROVIDER_LABELS[research.data.provider]?.name})</p>
            <button type="button" onClick={() => setShowPreview(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-1">Közmű</th>
                <th className="pb-1">Jelenlegi</th>
                <th className="pb-1">AI javaslat</th>
                <th className="pb-1">Változás</th>
              </tr>
            </thead>
            <tbody>
              {(["villany", "viz", "csatorna", "gaz"] as const).map((ut) => {
                const current = currentTariffs.find((t) => t.utilityType === ut);
                const newRate = research.data!.result[ut === "villany" ? "villany_rezsis" : ut === "gaz" ? "gaz_rezsis" : ut];
                const diff = current ? newRate - current.rateHuf : 0;
                return (
                  <tr key={ut} className="border-t border-border/30">
                    <td className="py-1.5 font-medium">{utilityLabels[ut]}</td>
                    <td className="py-1.5 tabular-nums text-muted-foreground">{current?.rateHuf ?? "—"} Ft</td>
                    <td className="py-1.5 tabular-nums font-medium">{newRate} Ft</td>
                    <td className={`py-1.5 tabular-nums text-xs ${diff > 0 ? "text-rose-600" : diff < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {diff !== 0 ? `${diff > 0 ? "+" : ""}${diff}` : "="}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {research.data.result.megjegyzes && (
            <p className="text-[10px] text-muted-foreground">{research.data.result.megjegyzes}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                apply.mutate({
                  tariffGroupId,
                  rates: {
                    villany: research.data!.result.villany_rezsis,
                    viz: research.data!.result.viz,
                    csatorna: research.data!.result.csatorna,
                    gaz: research.data!.result.gaz_rezsis,
                  },
                })
              }
              disabled={apply.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {apply.isPending ? "Frissítés..." : "Alkalmazás"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Mégse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
