"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Víz",
  gaz: "Gáz",
  csatorna: "Csatorna",
  internet: "Internet",
  kozos_koltseg: "Közös költség",
  egyeb: "Egyéb",
};

const unitDefaults: Record<string, string> = {
  villany: "kWh",
  viz: "m³",
  gaz: "m³",
  csatorna: "m³",
  internet: "hó",
  kozos_koltseg: "hó",
  egyeb: "",
};

export default function NewTariffPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = Number(params.groupId);

  const [utilityType, setUtilityType] = useState("villany");
  const [rateHuf, setRateHuf] = useState("");
  const [unit, setUnit] = useState("kWh");
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().split("T")[0]!,
  );

  const createTariff = api.tariff.createTariff.useMutation({
    onSuccess: () => {
      router.push("/tariffs");
      router.refresh();
    },
  });

  const handleTypeChange = (type: string) => {
    setUtilityType(type);
    setUnit(unitDefaults[type] ?? "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTariff.mutate({
      tariffGroupId: groupId,
      utilityType: utilityType as "villany",
      rateHuf: Number(rateHuf),
      unit,
      validFrom,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Új tarifa</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">Közmű típus</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(utilityLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTypeChange(key)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  utilityType === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              Díj (Ft) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={rateHuf}
              onChange={(e) => setRateHuf(e.target.value)}
              placeholder="pl. 36.5"
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Egység</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kWh, m³, hó"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Érvényes ettől</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!rateHuf || createTariff.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createTariff.isPending ? "Mentés..." : "Hozzáadás"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/tariffs")}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
