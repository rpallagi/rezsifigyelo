"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export default function NewPropertyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState<
    "lakas" | "uzlet" | "telek" | "egyeb"
  >("lakas");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");

  const createProperty = api.property.create.useMutation({
    onSuccess: (property) => {
      if (property) {
        router.push(`/properties/${property.id}`);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProperty.mutate({
      name,
      propertyType,
      address: address || undefined,
      contactName: contactName || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      notes: notes || undefined,
    });
  };

  const typeLabels = {
    lakas: "Lakás",
    uzlet: "Üzlet",
    telek: "Telek",
    egyeb: "Egyéb",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Új ingatlan</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium">
            Név <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. 1. Lakás, Üzlet, Garázs"
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium">Típus</label>
          <div className="mt-2 flex gap-2">
            {(
              Object.entries(typeLabels) as [
                keyof typeof typeLabels,
                string,
              ][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPropertyType(value)}
                className={`rounded-md border px-4 py-2 text-sm ${
                  propertyType === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium">Cím</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="pl. 1234 Budapest, Kossuth u. 1."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Contact */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Kapcsolattartó</legend>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-muted-foreground">Név</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Telefon
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </fieldset>

        {/* Financial */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Pénzügyi adatok</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">
                Havi bérleti díj (Ft)
              </label>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Vételár (Ft)
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </fieldset>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium">Megjegyzés</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!name || createProperty.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createProperty.isPending ? "Mentés..." : "Létrehozás"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/properties")}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>

        {createProperty.error && (
          <p className="text-sm text-destructive">
            Hiba: {createProperty.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
