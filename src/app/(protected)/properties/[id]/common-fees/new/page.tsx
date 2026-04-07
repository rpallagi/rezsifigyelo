"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function NewCommonFeePage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [paymentDay, setPaymentDay] = useState("");
  const [notes, setNotes] = useState("");

  const create = api.commonFee.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      propertyId,
      monthlyAmount: Number(monthlyAmount),
      bankAccount: bankAccount || undefined,
      recipient: recipient || undefined,
      paymentMemo: paymentMemo || undefined,
      frequency,
      paymentDay: paymentDay ? Number(paymentDay) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Közös költség hozzáadás</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">
            Havi összeg (Ft) <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            required
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

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Gyakoriság</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="monthly">Havi</option>
              <option value="quarterly">Negyedéves</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">
              Fizetési nap (hónap napja)
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={paymentDay}
              onChange={(e) => setPaymentDay(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Megjegyzés</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!monthlyAmount || create.isPending}
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
