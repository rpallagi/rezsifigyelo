"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, FileText, X } from "lucide-react";
import { api } from "@/trpc/react";
import { AddressInput } from "@/components/shared/address-input";
import { PhoneInput } from "@/components/shared/phone-input";
import { CurrencyInput } from "@/components/shared/currency-input";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

type PendingDoc = {
  url: string;
  filename: string;
  size: number;
  type: string;
  category: string;
};

export default function NewPropertyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState("lakas");
  const [customType, setCustomType] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [landlordProfileId, setLandlordProfileId] = useState("");
  const [buildingArea, setBuildingArea] = useState("");
  const [landArea, setLandArea] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [rentCurrency, setRentCurrency] = useState<"HUF" | "EUR">("HUF");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchasePriceCurrency, setPurchasePriceCurrency] = useState<"HUF" | "EUR">("HUF");
  const [notes, setNotes] = useState("");
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
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

  const createProperty = api.property.create.useMutation();
  const createDocument = api.document.create.useMutation();

  const handleDocFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDocUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "property-documents");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) continue;
        const payload = (await res.json()) as { url: string; filename: string; size: number; type: string };
        setPendingDocs((prev) => [...prev, { ...payload, category: "egyeb" }]);
      }
    } finally {
      setDocUploading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const property = await createProperty.mutateAsync({
      name,
      propertyType,
      address: address || undefined,
      contactName: contactName || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      landlordProfileId: landlordProfileId ? Number(landlordProfileId) : undefined,
      buildingArea: buildingArea ? Number(buildingArea) : undefined,
      landArea: landArea ? Number(landArea) : undefined,
      monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
      rentCurrency,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      purchasePriceCurrency,
      notes: notes || undefined,
    });
    if (!property) return;

    // Save uploaded documents
    for (const doc of pendingDocs) {
      await createDocument.mutateAsync({
        propertyId: property.id,
        filename: doc.filename,
        storedUrl: doc.url,
        category: doc.category as "egyeb",
        fileSize: doc.size,
        mimeType: doc.type,
      });
    }

    router.push(`/properties/${property.id}`);
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
              <PhoneInput
                value={contactPhone}
                onChange={setContactPhone}
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
              <label className="block text-xs text-muted-foreground">Havi bérleti díj</label>
              <div className="mt-1 flex gap-2">
                <CurrencyInput
                  value={monthlyRent}
                  onChange={setMonthlyRent}
                  placeholder="0"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-1 rounded-md border border-border p-0.5">
                  {(["HUF", "EUR"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRentCurrency(c)}
                      className={`rounded px-2.5 py-1.5 text-xs font-medium transition ${
                        rentCurrency === c
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c === "HUF" ? "Ft" : "€"}
                    </button>
                  ))}
                </div>
              </div>
              {monthlyRent && buildingArea && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  ≈ {Math.round(Number(monthlyRent) / Number(buildingArea)).toLocaleString("hu-HU")} {rentCurrency === "HUF" ? "Ft" : "€"}/m²
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Vételár</label>
              <div className="mt-1 flex gap-2">
                <CurrencyInput
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  placeholder="0"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-1 rounded-md border border-border p-0.5">
                  {(["HUF", "EUR"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPurchasePriceCurrency(c)}
                      className={`rounded px-2.5 py-1.5 text-xs font-medium transition ${
                        purchasePriceCurrency === c
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c === "HUF" ? "Ft" : "€"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* Documents */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Dokumentumok (opcionális)</legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Adásvételi szerződés, tulajdoni lap, SZMSZ, energetikai tanúsítvány stb.
          </p>

          {pendingDocs.length > 0 && (
            <div className="mb-4 space-y-2">
              {pendingDocs.map((doc, idx) => (
                <div
                  key={doc.url}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{doc.filename}</span>
                  <select
                    value={doc.category}
                    onChange={(e) => {
                      setPendingDocs((prev) =>
                        prev.map((d, i) => (i === idx ? { ...d, category: e.target.value } : d)),
                      );
                    }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPendingDocs((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded-full p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={docUploading}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {docUploading ? (
              <span>Feltöltés...</span>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Dokumentum feltöltése
              </>
            )}
          </button>
          <input
            ref={docInputRef}
            type="file"
            multiple
            accept="application/pdf,.doc,.docx,.xls,.xlsx,image/*"
            className="hidden"
            onChange={(e) => void handleDocFiles(e.target.files)}
          />
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
