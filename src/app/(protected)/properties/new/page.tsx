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
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingTaxNumber, setBillingTaxNumber] = useState("");
  const [billingBuyerType, setBillingBuyerType] = useState<"individual" | "company">(
    "individual",
  );
  const [billingVatCode, setBillingVatCode] = useState<"TAM" | "AAM" | "27">("TAM");
  const [billingMode, setBillingMode] = useState<"advance" | "arrears">("advance");
  const [billingDueDay, setBillingDueDay] = useState("5");
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
      billingName: billingName || undefined,
      billingEmail: billingEmail || undefined,
      billingAddress: billingAddress || undefined,
      billingTaxNumber: billingTaxNumber || undefined,
      billingBuyerType,
      billingVatCode,
      billingMode,
      billingDueDay: Number(billingDueDay || 5),
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

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Számlázási profil</legend>
          <p className="mb-4 text-xs text-muted-foreground">
            A billing oldal ezt a profilt használja elsődleges vevőadatként. Ha üres,
            fallbackként az aktív bérlőt vagy a kapcsolattartót használja.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Vevő neve</label>
              <input
                type="text"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Vevő email</label>
              <input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground">Számlázási cím</label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="pl. 1222 Budapest, Portyázó út 32"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Vevő típusa</label>
              <select
                value={billingBuyerType}
                onChange={(e) =>
                  setBillingBuyerType(e.target.value as "individual" | "company")
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="individual">Magánszemély</option>
                <option value="company">Cég</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                Adószám {billingBuyerType === "company" ? "*" : ""}
              </label>
              <input
                type="text"
                value={billingTaxNumber}
                onChange={(e) => setBillingTaxNumber(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">ÁFA / adózási kód</label>
              <select
                value={billingVatCode}
                onChange={(e) => setBillingVatCode(e.target.value as "TAM" | "AAM" | "27")}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="TAM">TAM</option>
                <option value="AAM">AAM</option>
                <option value="27">27% ÁFA</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Számlázás módja</label>
              <select
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value as "advance" | "arrears")}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="advance">Előre számlázás</option>
                <option value="arrears">Utólagos számlázás</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Fizetési határnap</label>
              <input
                type="number"
                min="1"
                max="31"
                value={billingDueDay}
                onChange={(e) => setBillingDueDay(e.target.value)}
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
