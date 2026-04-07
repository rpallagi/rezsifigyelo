"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const { data: property, isLoading } = api.property.get.useQuery({
    id: propertyId,
  });

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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [buildingPropertyId, setBuildingPropertyId] = useState<string>("");

  const { data: allProperties } = api.property.list.useQuery();
  const buildings = allProperties?.filter(
    (p) => (p.propertyType === "lakas" || p.propertyType === "uzlet") === false && p.id !== propertyId,
  );

  useEffect(() => {
    if (property) {
      setName(property.name);
      setPropertyType(property.propertyType);
      setAddress(property.address ?? "");
      setContactName(property.contactName ?? "");
      setContactPhone(property.contactPhone ?? "");
      setContactEmail(property.contactEmail ?? "");
      setMonthlyRent(property.monthlyRent?.toString() ?? "");
      setPurchasePrice(property.purchasePrice?.toString() ?? "");
      setNotes(property.notes ?? "");
      setBuildingPropertyId(property.buildingPropertyId?.toString() ?? "");
    }
  }, [property]);

  const updateProperty = api.property.update.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProperty.mutate({
      id: propertyId,
      name,
      propertyType,
      address: address || undefined,
      contactName: contactName || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      notes: notes || undefined,
      buildingPropertyId: buildingPropertyId ? Number(buildingPropertyId) : undefined,
    });
  };

  const typeLabels = {
    lakas: "Lakás",
    uzlet: "Üzlet",
    telek: "Telek",
    egyeb: "Egyéb",
  };

  if (isLoading) return <p className="text-muted-foreground">Betöltés...</p>;
  if (!property) return <p className="text-destructive">Ingatlan nem található.</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Ingatlan szerkesztése</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium">Név</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

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

        <div>
          <label className="block text-sm font-medium">Cím</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

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
              <label className="block text-xs text-muted-foreground">Telefon</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Email</label>
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
          <legend className="px-2 text-sm font-medium">Pénzügyi adatok</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Havi bérleti díj (Ft)</label>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Vételár (Ft)</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </fieldset>

        {/* Building hierarchy */}
        <div>
          <label className="block text-sm font-medium">Épület (szülő ingatlan)</label>
          <select
            value={buildingPropertyId}
            onChange={(e) => setBuildingPropertyId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Nincs (önálló)</option>
            {allProperties
              ?.filter((p) => p.id !== propertyId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Ha ez egy lakás egy épületben, válaszd ki a szülő épületet
          </p>
        </div>

        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium">Ingatlan fotó</label>
          {property?.avatarUrl && (
            <img
              src={property.avatarUrl}
              alt={property.name}
              className="mt-2 h-24 w-24 rounded-lg object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAvatarUploading(true);
              try {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/upload", { method: "POST", body: formData });
                const data = await res.json();
                if (data.url) {
                  updateProperty.mutate({ id: propertyId, avatarUrl: data.url });
                }
              } finally {
                setAvatarUploading(false);
              }
            }}
            className="mt-2 text-sm"
          />
          {avatarUploading && <p className="mt-1 text-xs text-muted-foreground">Feltöltés...</p>}
        </div>

        <div>
          <label className="block text-sm font-medium">Megjegyzés</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!name || updateProperty.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateProperty.isPending ? "Mentés..." : "Mentés"}
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
