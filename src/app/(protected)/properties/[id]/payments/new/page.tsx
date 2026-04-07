"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function NewPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [amountHuf, setAmountHuf] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [paymentMethod, setPaymentMethod] = useState("átutalás");
  const [notes, setNotes] = useState("");

  const createPayment = api.payment.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPayment.mutate({
      propertyId,
      amountHuf: Number(amountHuf),
      paymentDate,
      paymentMethod: paymentMethod || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Befizetés rögzítés</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">
            Összeg (Ft) <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            value={amountHuf}
            onChange={(e) => setAmountHuf(e.target.value)}
            placeholder="pl. 150000"
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Dátum</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Fizetési mód</label>
          <div className="mt-2 flex gap-2">
            {["átutalás", "készpénz", "kártya"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                  paymentMethod === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {m}
              </button>
            ))}
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
            disabled={!amountHuf || createPayment.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createPayment.isPending ? "Mentés..." : "Rögzítés"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>

        {createPayment.error && (
          <p className="text-sm text-destructive">
            Hiba: {createPayment.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
