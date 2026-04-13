"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { MultiPhotoUpload, type UploadedPhoto } from "@/components/shared/multi-photo-upload";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Viz",
  gaz: "Gaz",
  csatorna: "Csatorna",
  internet: "Internet",
  kozos_koltseg: "Kozos koltseg",
  egyeb: "Egyeb",
};

export default function EditMeterPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);
  const meterId = Number(params.meterId);

  const { data: meter, isLoading } = api.meter.get.useQuery({ id: meterId });
  const { data: tariffGroups } = api.tariff.listGroups.useQuery();
  const utils = api.useUtils();

  const [location, setLocation] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [tariffGroupId, setTariffGroupId] = useState<string>("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [meterType, setMeterType] = useState<"physical" | "virtual">("physical");
  const [primaryMeterId, setPrimaryMeterId] = useState<string>("");
  const [subtractMeterIds, setSubtractMeterIds] = useState<number[]>([]);

  const { data: buildingMeters } = api.meter.listByBuilding.useQuery(
    { propertyId },
    { enabled: meterType === "virtual" },
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMeter = api.meter.update.useMutation();
  const deleteMeter = api.meter.delete.useMutation();

  useEffect(() => {
    if (meter) {
      setLocation(meter.location ?? "");
      setSerialNumber(meter.serialNumber ?? "");
      setTariffGroupId(meter.tariffGroupId ? String(meter.tariffGroupId) : "");
      setMeterType((meter.meterType as "physical" | "virtual") ?? "physical");
      setPrimaryMeterId(meter.primaryMeterId ? String(meter.primaryMeterId) : "");
      setSubtractMeterIds(Array.isArray(meter.subtractMeterIds) ? meter.subtractMeterIds as number[] : []);
      if (Array.isArray(meter.photoUrls)) {
        setPhotos(
          (meter.photoUrls as string[]).map((url) => ({
            url,
            name: url.split("/").pop() ?? "photo",
          })),
        );
      }
    }
  }, [meter]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMeter.mutateAsync({
        id: meterId,
        location: location || undefined,
        serialNumber: serialNumber || undefined,
        tariffGroupId: tariffGroupId ? Number(tariffGroupId) : null,
        photoUrls: photos.map((p) => p.url),
        meterType,
        formulaType: meterType === "virtual" ? "subtraction" : null,
        primaryMeterId: meterType === "virtual" && primaryMeterId ? Number(primaryMeterId) : null,
        subtractMeterIds: meterType === "virtual" && subtractMeterIds.length > 0 ? subtractMeterIds : null,
      });
      await utils.property.get.invalidate({ id: propertyId });
      router.push(`/properties/${propertyId}`);
    } catch {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMeter.mutateAsync({ id: meterId });
      await utils.property.get.invalidate({ id: propertyId });
      router.push(`/properties/${propertyId}`);
    } catch {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meter) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-muted-foreground">Mérő nem található.</p>
        <Link href={`/properties/${propertyId}`} className="mt-4 inline-block text-primary hover:underline">
          Vissza
        </Link>
      </div>
    );
  }

  // Find the effective tariff for this meter's utility type from the selected group
  const selectedGroup = tariffGroups?.find((g) => String(g.id) === tariffGroupId);
  const matchingTariff = selectedGroup?.tariffs
    ?.filter((t) => t.utilityType === meter.utilityType)
    .sort((a, b) => String(b.validFrom).localeCompare(String(a.validFrom)))[0];

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/properties/${propertyId}`}
          className="rounded-full p-2 transition hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Mérőóra szerkesztés</h1>
          <p className="text-sm text-muted-foreground">
            {utilityLabels[meter.utilityType] ?? meter.utilityType}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60">
        {/* Utility type (read-only) */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Közműtípus</label>
          <p className="mt-1 font-medium">{utilityLabels[meter.utilityType] ?? meter.utilityType}</p>
        </div>

        {/* Serial number */}
        <div>
          <label htmlFor="serialNumber" className="text-sm font-medium">
            Gyári szám
          </label>
          <input
            id="serialNumber"
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="pl. 12345678"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="text-sm font-medium">
            Helyszín
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="pl. Pince, szekrenyben"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Tariff group selector */}
        <div>
          <label htmlFor="tariffGroupId" className="text-sm font-medium">
            Tarifa csoport
          </label>
          <select
            id="tariffGroupId"
            value={tariffGroupId}
            onChange={(e) => setTariffGroupId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Ingatlan alapertelmezese</option>
            {tariffGroups?.map((group) => (
              <option key={group.id} value={String(group.id)}>
                {group.name}
              </option>
            ))}
          </select>
          {/* Show matching tariff preview */}
          {tariffGroupId && (
            <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs">
              {matchingTariff ? (
                <p>
                  Aktiv tarifa: <span className="font-semibold">{matchingTariff.rateHuf} Ft/{matchingTariff.unit}</span>
                  <span className="text-muted-foreground"> (erv. {matchingTariff.validFrom})</span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Nincs {utilityLabels[meter.utilityType]?.toLowerCase() ?? meter.utilityType} tarifa ebben a csoportban.
                </p>
              )}
            </div>
          )}
          {!tariffGroupId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Ha nem választasz, az ingatlanhoz rendelt tarifa csoport érvényes.
            </p>
          )}
        </div>

        {/* Virtual meter (calculated consumption) */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Számított fogyasztás</label>
            <button
              type="button"
              onClick={() => setMeterType(meterType === "virtual" ? "physical" : "virtual")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                meterType === "virtual" ? "bg-primary" : "bg-secondary"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  meterType === "virtual" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fogyasztás = főmérő - almérő(k). Hasznos ha egy főmérő alatt több unit van és az egyiknek van saját mérője.
          </p>

          {meterType === "virtual" && (
            <div className="space-y-3 pt-2">
              {/* Primary meter (main meter) */}
              <div>
                <label className="text-sm font-medium">Főmérő</label>
                <select
                  value={primaryMeterId}
                  onChange={(e) => setPrimaryMeterId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Válassz főmérőt...</option>
                  {buildingMeters
                    ?.filter((m) => m.utilityType === meter?.utilityType)
                    .map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.property?.name} — {m.utilityType} {m.serialNumber ? `(${m.serialNumber})` : ""} {m.location ?? ""} {m.id === meterId ? "(ez a mero)" : ""}
                      </option>
                    ))}
                </select>
              </div>

              {/* Subtract meters */}
              <div>
                <label className="text-sm font-medium">Levonandó almérő(k)</label>
                <div className="mt-1 space-y-1.5">
                  {buildingMeters
                    ?.filter((m) => m.id !== Number(primaryMeterId) && m.utilityType === meter?.utilityType)
                    .map((m) => {
                      const checked = subtractMeterIds.includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/80">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSubtractMeterIds(
                                checked
                                  ? subtractMeterIds.filter((id) => id !== m.id)
                                  : [...subtractMeterIds, m.id],
                              )
                            }
                            className="rounded"
                          />
                          {m.property?.name} — {m.utilityType} {m.serialNumber ? `(${m.serialNumber})` : ""} {m.location ?? ""}
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Formula preview */}
              {primaryMeterId && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                  <span className="font-medium">Képlet: </span>
                  {buildingMeters?.find((m) => m.id === Number(primaryMeterId))?.property?.name ?? "Főmérő"}
                  {subtractMeterIds.map((sid) => {
                    const sm = buildingMeters?.find((m) => m.id === sid);
                    return ` - ${sm?.property?.name ?? "Almérő"}`;
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Photos */}
        <MultiPhotoUpload
          photos={photos}
          onChange={setPhotos}
          folder={`meters/${meterId}`}
          maxPhotos={5}
          label="Mérőfotók"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Mentés
        </button>
        <Link
          href={`/properties/${propertyId}`}
          className="flex items-center justify-center rounded-full bg-secondary px-4 py-3 text-sm font-medium transition hover:bg-secondary/80"
        >
          Mégse
        </Link>
      </div>

      {/* Delete */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-sm text-destructive hover:underline"
          >
            <Trash2 className="h-4 w-4" />
            Mérőóra törlése
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Biztosan törlöd ezt a mérőórát? A hozzátartozó okos mérő kapcsolat is törlődik.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Igen, törlés
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium transition hover:bg-secondary/80"
              >
                Mégse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
