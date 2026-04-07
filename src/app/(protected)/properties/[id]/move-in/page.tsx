"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

const steps = [
  { key: "tenant", label: "Bérlő adatai" },
  { key: "readings", label: "Nyitó mérőállások" },
  { key: "contract", label: "Szerződés" },
  { key: "keys", label: "Kulcsátadás" },
];

export default function MoveInWizardPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);
  const [step, setStep] = useState(0);

  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [moveInDate, setMoveInDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [depositAmount, setDepositAmount] = useState("");

  const moveIn = api.tenancy.moveIn.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleFinish = () => {
    moveIn.mutate({
      propertyId,
      tenantEmail,
      tenantName: tenantName || undefined,
      moveInDate,
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Beköltözés</h1>

      {/* Progress */}
      <div className="mt-6 flex gap-2">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className={`flex-1 rounded-full py-1 text-center text-xs ${
              i <= step
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="mt-8">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">
                Bérlő email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                placeholder="berlo@email.com"
                required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A bérlő erre az emailre kap meghívót
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Bérlő neve</label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">
                  Beköltözés dátuma
                </label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Kaució (Ft)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rögzítsd a nyitó mérőállásokat az ingatlan oldalon a beköltözés
              után. A beköltözés checklist automatikusan létrejön.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Töltsd fel a bérleti szerződést az ingatlan Dokumentumok fülén.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kulcsátadás — a checklist automatikusan létrejön a beköltözés
              indításakor.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={() => (step > 0 ? setStep(step - 1) : router.back())}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            {step === 0 ? "Mégse" : "Vissza"}
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !tenantEmail}
              className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Tovább
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={moveIn.isPending}
              className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {moveIn.isPending ? "Indítás..." : "Beköltözés indítása"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
