"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { CurrencyInput } from "@/components/shared/currency-input";

export default function MoveOutPage() {
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
      router.refresh();
      router.push(`/properties/${propertyId}`);
    },
  });

  if (!property) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 h-64 animate-pulse rounded-[28px] bg-muted" />
      </div>
    );
  }

  if (!activeTenancy) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <h1 className="text-2xl font-bold">Kiköltözés</h1>
        <p className="mt-4 text-muted-foreground">
          Nincs aktív bérlő ebben az ingatlanban.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          Vissza
        </button>
      </div>
    );
  }

  const tenantDisplayName =
    activeTenancy.tenant
      ? `${activeTenancy.tenant.firstName ?? ""} ${activeTenancy.tenant.lastName ?? ""}`.trim() || activeTenancy.tenant.email
      : activeTenancy.tenantName ?? activeTenancy.tenantEmail ?? "Bérlő";

  const handleSubmit = () => {
    moveOut.mutate({
      tenancyId: activeTenancy.id,
      moveOutDate,
      depositReturned: depositReturned ? Number(depositReturned) : undefined,
      depositDeductions: depositDeductions ? Number(depositDeductions) : undefined,
      depositNotes: depositNotes || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Vissza
        </button>
        <h1 className="mt-3 text-2xl font-bold">Kiköltözés</h1>
        <p className="mt-1 text-muted-foreground">
          {property.name} · {tenantDisplayName}
        </p>
      </div>

      {/* Teendők a kiköltözés előtt */}
      <section className="rounded-[24px] border border-border p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Teendők a kiköltözés előtt
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Opcionális, de ajánlott. A kiköltözés ezek nélkül is véglegesíthető.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/properties/${propertyId}/readings/new`}
            className="rounded-[18px] bg-background/80 p-4 ring-1 ring-border/50 transition hover:bg-secondary/50"
          >
            <p className="text-sm font-semibold">Záró mérőállások</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rögzítsd a záró értékeket az elszámoláshoz.
            </p>
          </Link>
          <Link
            href={`/properties/${propertyId}/documents/new`}
            className="rounded-[18px] bg-background/80 p-4 ring-1 ring-border/50 transition hover:bg-secondary/50"
          >
            <p className="text-sm font-semibold">Átadás-átvételi jegyzőkönyv</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Állapotfelvétel és fotódokumentáció feltöltése.
            </p>
          </Link>
        </div>
      </section>

      {/* Dátum */}
      <section className="rounded-[24px] border border-border p-5">
        <label className="block text-sm font-semibold">Kiköltözés dátuma</label>
        <input
          type="date"
          value={moveOutDate}
          onChange={(e) => setMoveOutDate(e.target.value)}
          className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </section>

      {/* Kaució */}
      <section className="rounded-[24px] border border-border p-5">
        <h2 className="text-sm font-semibold">Kaució elszámolás</h2>
        {activeTenancy.depositAmount ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Letétbe helyezett kaució: <span className="font-semibold">{activeTenancy.depositAmount.toLocaleString("hu-HU")} {activeTenancy.depositCurrency === "EUR" ? "€" : "Ft"}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Nem volt kaució rögzítve a beköltözéskor.
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-muted-foreground">Visszaadott összeg ({activeTenancy.depositCurrency === "EUR" ? "€" : "Ft"})</label>
            <CurrencyInput
              value={depositReturned}
              onChange={setDepositReturned}
              placeholder={activeTenancy.depositAmount ? String(activeTenancy.depositAmount) : "0"}
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Levonás ({activeTenancy.depositCurrency === "EUR" ? "€" : "Ft"})</label>
            <CurrencyInput
              value={depositDeductions}
              onChange={setDepositDeductions}
              placeholder="0"
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs text-muted-foreground">Megjegyzés a kaucióhoz</label>
          <textarea
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
            rows={2}
            placeholder="pl. festés költsége, törött csempe stb."
            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-border px-5 py-3 text-sm font-medium transition hover:bg-muted/60"
        >
          Mégse
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={moveOut.isPending}
          className="rounded-xl bg-destructive px-6 py-3 text-sm font-semibold text-white transition hover:bg-destructive/90 disabled:opacity-50"
        >
          {moveOut.isPending ? "Feldolgozás..." : "Kiköltözés véglegesítése"}
        </button>
      </div>

      {moveOut.error && (
        <p className="text-sm text-destructive">Hiba: {moveOut.error.message}</p>
      )}
    </div>
  );
}
