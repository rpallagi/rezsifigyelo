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

export default function NewMeterPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [utilityType, setUtilityType] = useState<string>("villany");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");

  const createMeter = api.meter.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMeter.mutate({
      propertyId,
      utilityType: utilityType as "villany",
      serialNumber: serialNumber || undefined,
      location: location || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Mérőóra hozzáadás</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">Közmű típus</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(utilityLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setUtilityType(key)}
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

        <div>
          <label className="block text-sm font-medium">Gyári szám</label>
          <input
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="pl. ABC123456"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Helyszín</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="pl. Pince, Konyha, Előszoba"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMeter.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createMeter.isPending ? "Mentés..." : "Hozzáadás"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>

        {createMeter.error && (
          <p className="text-sm text-destructive">
            Hiba: {createMeter.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
