"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function MoveOutWizardPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const { data: property } = api.property.get.useQuery({ id: propertyId });

  const activeTenancy = property?.tenancies.find((t) => t.active);

  const [moveOutDate, setMoveOutDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [depositReturned, setDepositReturned] = useState("");
  const [depositDeductions, setDepositDeductions] = useState("");
  const [depositNotes, setDepositNotes] = useState("");

  const moveOut = api.tenancy.moveOut.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  if (!activeTenancy) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold">Kiköltözés</h1>
        <p className="mt-4 text-muted-foreground">
          Nincs aktív bérlő ebben az ingatlanban.
        </p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    moveOut.mutate({
      tenancyId: activeTenancy.id,
      moveOutDate,
      depositReturned: depositReturned ? Number(depositReturned) : undefined,
      depositDeductions: depositDeductions
        ? Number(depositDeductions)
        : undefined,
      depositNotes: depositNotes || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Kiköltözés</h1>
      <p className="mt-2 text-muted-foreground">
        Bérlő: {activeTenancy.tenant?.firstName ?? activeTenancy.tenantName ?? activeTenancy.tenant?.email ?? activeTenancy.tenantEmail ?? ""}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">Kiköltözés dátuma</label>
          <input
            type="date"
            value={moveOutDate}
            onChange={(e) => setMoveOutDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Kaució elszámolás</legend>
          {activeTenancy.depositAmount && (
            <p className="mb-3 text-sm text-muted-foreground">
              Kaució: {activeTenancy.depositAmount.toLocaleString("hu-HU")} Ft
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">
                Visszaadott összeg (Ft)
              </label>
              <input
                type="number"
                value={depositReturned}
                onChange={(e) => setDepositReturned(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Levonás (Ft)
              </label>
              <input
                type="number"
                value={depositDeductions}
                onChange={(e) => setDepositDeductions(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-muted-foreground">
              Megjegyzés
            </label>
            <textarea
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </fieldset>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={moveOut.isPending}
            className="rounded-md bg-destructive px-6 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
          >
            {moveOut.isPending ? "Feldolgozás..." : "Kiköltözés véglegesítése"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
