"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function NewPropertyTaxPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [annualAmount, setAnnualAmount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [notes, _setNotes] = useState("");

  const create = api.propertyTax.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      propertyId,
      year: Number(year),
      annualAmount: Number(annualAmount),
      installmentAmount: installmentAmount
        ? Number(installmentAmount)
        : undefined,
      bankAccount: bankAccount || undefined,
      recipient: recipient || undefined,
      paymentMemo: paymentMemo || undefined,
      deadlineAutumn: `${year}-09-15`,
      deadlineSpring: `${Number(year) + 1}-03-15`,
      notes: notes || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Ingatlanadó hozzáadás</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              Év <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Éves összeg (Ft) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              value={annualAmount}
              onChange={(e) => setAnnualAmount(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Részlet összeg (Ft)
          </label>
          <input
            type="number"
            value={installmentAmount}
            onChange={(e) => setInstallmentAmount(e.target.value)}
            placeholder="Éves összeg / 2"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Számlaszám</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Kedvezményezett</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Közlemény</label>
          <input
            type="text"
            value={paymentMemo}
            onChange={(e) => setPaymentMemo(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Határidők automatikusan: szept. 15 és márc. 15
        </p>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!annualAmount || create.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? "Mentés..." : "Hozzáadás"}
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
