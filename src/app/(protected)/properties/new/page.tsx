"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { AddressInput } from "@/components/shared/address-input";

export default function NewPropertyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState("lakas");
  const [customType, setCustomType] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [landlordProfileId, setLandlordProfileId] = useState("");
  const [buildingArea, setBuildingArea] = useState("");
  const [landArea, setLandArea] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const { data: landlordProfiles } = api.landlordProfile.list.useQuery();
  const { data: existingProperties } = api.property.list.useQuery();

  // Collect all unique property types from existing properties
  const defaultTypes: Record<string, string> = {
    lakas: "Lakás", uzlet: "Üzlet", telek: "Telek", egyeb: "Egyéb",
  };
  const customTypes = [...new Set(
    (existingProperties ?? [])
      .map((p) => p.propertyType)
      .filter((t) => !Object.keys(defaultTypes).includes(t))
  )];
  const allTypeButtons = [
    ...Object.entries(defaultTypes),
    ...customTypes.map((t) => [t, t] as [string, string]),
  ];

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
      landlordProfileId: landlordProfileId ? Number(landlordProfileId) : undefined,
      buildingArea: buildingArea ? Number(buildingArea) : undefined,
      landArea: landArea ? Number(landArea) : undefined,
      monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Új ingatlan</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Landlord profile - FIRST */}
        <fieldset className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
          <legend className="px-2 text-sm font-semibold">Ki adja ki? <span className="text-destructive">*</span></legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Válaszd ki melyik kiadó entitás (céged, magánszemélyként te, vagy vagyonközösség) állítja ki a számlákat ennél az ingatlannál.
          </p>
          {landlordProfiles && landlordProfiles.length > 0 ? (
            <div className="space-y-2">
              {landlordProfiles.map((profile) => (
                <label
                  key={profile.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                    landlordProfileId === String(profile.id)
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="landlordProfile"
                    value={profile.id}
                    checked={landlordProfileId === String(profile.id)}
                    onChange={(e) => setLandlordProfileId(e.target.value)}
                    className="accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{profile.displayName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        profile.profileType === "company"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : profile.profileType === "co_ownership"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}>
                        {profile.profileType === "company" ? "Cég" : profile.profileType === "co_ownership" ? "Közösség" : "Magán"}
                      </span>
                      {profile.isDefault && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          alapértelmezett
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {profile.billingName}{profile.taxNumber ? ` · ${profile.taxNumber}` : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background/80 p-4 text-center">
              <p className="text-sm text-muted-foreground">Még nincs kiadói profilod.</p>
              <Link
                href="/settings/landlord-profiles"
                className="mt-2 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Kiadói profil létrehozása
              </Link>
            </div>
          )}
          {landlordProfiles && landlordProfiles.length > 0 && (
            <Link
              href="/settings/landlord-profiles"
              className="mt-3 inline-flex text-xs text-muted-foreground hover:text-foreground"
            >
              Profilok kezelése →
            </Link>
          )}
        </fieldset>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium">
            Megnevezés <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. Portyázó lakás, Astoria üzlet, Garázs"
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium">Típus</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {allTypeButtons.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setPropertyType(value); setCustomType(""); }}
                className={`rounded-md border px-4 py-2 text-sm ${
                  propertyType === value && !customType
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
            <input
              type="text"
              value={customType}
              onChange={(e) => { setCustomType(e.target.value); if (e.target.value) setPropertyType(e.target.value); }}
              placeholder="+ Új típus..."
              className={`rounded-md border px-4 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-ring ${
                customType ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium">Cím</label>
          <div className="mt-1">
            <AddressInput
              value={address}
              onChange={setAddress}
              existingAddresses={[...new Set((existingProperties ?? []).map((p) => p.address).filter(Boolean) as string[])]}
            />
          </div>
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
          <legend className="px-2 text-sm font-medium">Vevő adatok (opcionális)</legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Ha a bérlő más néven vagy emailre kéri a számlát. Üresen hagyva a bérlő adatait használjuk.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Vevő neve</label>
              <input
                type="text"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="Üresen hagyva: bérlő neve"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Vevő email</label>
              <input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="Üresen hagyva: bérlő email"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </fieldset>

        {/* Area */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Terület</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Épület alapterület (m²)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={buildingArea}
                onChange={(e) => setBuildingArea(e.target.value)}
                placeholder="pl. 65"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Telek alapterület (m²)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={landArea}
                onChange={(e) => setLandArea(e.target.value)}
                placeholder="pl. 800"
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
              {monthlyRent && buildingArea && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  ≈ {Math.round(Number(monthlyRent) / Number(buildingArea)).toLocaleString("hu-HU")} Ft/m²
                </p>
              )}
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
