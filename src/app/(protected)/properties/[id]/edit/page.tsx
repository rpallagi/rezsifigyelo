"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { PropertyCoverImage } from "@/components/properties/property-cover-image";

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
  const [landlordProfileId, setLandlordProfileId] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [buildingPropertyId, setBuildingPropertyId] = useState<string>("");

  const { data: allProperties } = api.property.list.useQuery();
  const { data: landlordProfiles } = api.landlordProfile.list.useQuery();
  const utils = api.useUtils();

  useEffect(() => {
    if (property) {
      setName(property.name);
      setPropertyType(property.propertyType);
      setAddress(property.address ?? "");
      setContactName(property.contactName ?? "");
      setContactPhone(property.contactPhone ?? "");
      setContactEmail(property.contactEmail ?? "");
      setBillingName(property.billingName ?? "");
      setBillingEmail(property.billingEmail ?? "");
      setBillingAddress(property.billingAddress ?? "");
      setBillingTaxNumber(property.billingTaxNumber ?? "");
      setBillingBuyerType(property.billingBuyerType ?? "individual");
      setBillingVatCode((property.billingVatCode as "TAM" | "AAM" | "27") ?? "TAM");
      setBillingMode(property.billingMode ?? "advance");
      setBillingDueDay(String(property.billingDueDay ?? 5));
      setLandlordProfileId(property.landlordProfileId?.toString() ?? "");
      setMonthlyRent(property.monthlyRent?.toString() ?? "");
      setPurchasePrice(property.purchasePrice?.toString() ?? "");
      setNotes(property.notes ?? "");
      setAvatarUrl(property.avatarUrl ?? "");
      setBuildingPropertyId(property.buildingPropertyId?.toString() ?? "");
    }
  }, [property]);

  const updateProperty = api.property.update.useMutation({
    onSuccess: async () => {
      await utils.property.get.invalidate({ id: propertyId });
      await utils.property.list.invalidate();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProperty.mutateAsync({
      id: propertyId,
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
      landlordProfileId: landlordProfileId ? Number(landlordProfileId) : undefined,
      monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      notes: notes || undefined,
      buildingPropertyId: buildingPropertyId ? Number(buildingPropertyId) : undefined,
      avatarUrl: avatarUrl || undefined,
    });
    router.push(`/properties/${propertyId}`);
    router.refresh();
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
          <legend className="px-2 text-sm font-medium">Bérbeadói profil</legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Ez a profil lesz egyértelműen jelezve a számlázási felületen, és ebből az entitásból történik a számlázás.
          </p>
          <div>
            <label className="block text-xs text-muted-foreground">Kiállító profil</label>
            <select
              value={landlordProfileId}
              onChange={(e) => setLandlordProfileId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Alapértelmezett profil</option>
              {landlordProfiles?.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Vevő / számlacímzett alapadatok</legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Az itt mentett adatokból készül a vevő profil a számlázásnál. Mivel nálad
            előre számlázás a fő flow, ezt ez az ingatlan fogja alapértelmezetten használni.
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
          {avatarUrl && (
            <div className="mt-2 h-24 w-24 overflow-hidden rounded-lg">
              <PropertyCoverImage
                imageUrl={avatarUrl}
                title={property.name}
                className="h-full w-full object-cover"
                placeholderClassName="h-full w-full"
                placeholderBackground="linear-gradient(135deg, rgba(70,72,212,0.92), rgba(96,99,238,0.75)), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 42%)"
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = e.target.files?.[0];
              if (!file) return;
              setAvatarUploading(true);
              setAvatarError("");
              try {
                // Resize image client-side before upload
                const resized = await new Promise<Blob>((resolve, reject) => {
                  const img = new window.Image();
                  img.onload = () => {
                    const MAX = 1200;
                    let { width, height } = img;
                    if (width > MAX || height > MAX) {
                      const scale = MAX / Math.max(width, height);
                      width = Math.round(width * scale);
                      height = Math.round(height * scale);
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                      (blob) => (blob ? resolve(blob) : reject(new Error("Resize failed"))),
                      "image/jpeg",
                      0.85,
                    );
                  };
                  img.onerror = () => reject(new Error("Kép betöltése sikertelen"));
                  img.src = URL.createObjectURL(file);
                });

                const formData = new FormData();
                formData.append("file", new File([resized], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
                formData.append("folder", "property-avatars");

                const res = await fetch("/api/upload", { method: "POST", body: formData });
                const payload: unknown = await res.json();

                if (!res.ok) {
                  if (
                    payload &&
                    typeof payload === "object" &&
                    "error" in payload &&
                    typeof payload.error === "string"
                  ) {
                    throw new Error(payload.error);
                  }
                  throw new Error("Az upload nem sikerült.");
                }

                if (
                  payload &&
                  typeof payload === "object" &&
                  "url" in payload &&
                  typeof payload.url === "string"
                ) {
                  await updateProperty.mutateAsync({ id: propertyId, avatarUrl: payload.url });
                  setAvatarUrl(payload.url);
                } else {
                  throw new Error("Az upload válasza érvénytelen.");
                }
              } catch (error) {
                setAvatarError(
                  error instanceof Error ? error.message : "A thumbnail feltöltése nem sikerült.",
                );
              } finally {
                setAvatarUploading(false);
                input.value = "";
              }
            }}
            className="mt-2 text-sm"
          />
          {avatarUploading && <p className="mt-1 text-xs text-muted-foreground">Feltöltés...</p>}
          {avatarError && <p className="mt-1 text-xs text-destructive">{avatarError}</p>}
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
