"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

const categories = [
  "villanyszerelés",
  "vízszerelés",
  "festés",
  "takarítás",
  "kertészet",
  "zárcsere",
  "gépészet",
  "bútor",
  "egyéb",
];

export default function NewMaintenancePage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [costHuf, setCostHuf] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [performedDate, setPerformedDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );

  const createLog = api.maintenance.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLog.mutate({
      propertyId,
      description,
      category: category || undefined,
      costHuf: costHuf ? Number(costHuf) : undefined,
      performedBy: performedBy || undefined,
      performedDate: performedDate || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Karbantartás rögzítés</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">
            Leírás <span className="text-destructive">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            placeholder="Mi történt?"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Kategória</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Költség (Ft)</label>
            <input
              type="number"
              value={costHuf}
              onChange={(e) => setCostHuf(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Dátum</label>
            <input
              type="date"
              value={performedDate}
              onChange={(e) => setPerformedDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Ki végezte?</label>
          <input
            type="text"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            placeholder="pl. Kiss János villanyszerelő"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!description || createLog.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createLog.isPending ? "Mentés..." : "Rögzítés"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
