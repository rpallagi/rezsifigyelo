"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
