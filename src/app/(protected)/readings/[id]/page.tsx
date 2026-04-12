"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Zap, Droplets, Flame, Waves, Pencil, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { api } from "@/trpc/react";
import { MultiPhotoUpload, type UploadedPhoto } from "@/components/shared/multi-photo-upload";

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Víz",
  gaz: "Gáz",
  csatorna: "Csatorna",
  internet: "Internet",
  kozos_koltseg: "Közös költség",
  egyeb: "Egyéb",
};

const utilityUnits: Record<string, string> = {
  villany: "kWh",
  viz: "m³",
  gaz: "m³",
  csatorna: "m³",
};

const sourceLabels: Record<string, string> = {
  manual: "Kézi",
  tenant: "Bérlő",
  smart_mqtt: "Okos mérő",
  smart_ttn: "TTN",
  home_assistant: "Home Assistant",
};

function UtilityIcon({ type }: { type: string }) {
  if (type === "villany") return <Zap className="h-5 w-5" />;
  if (type === "gaz") return <Flame className="h-5 w-5" />;
  if (type === "csatorna") return <Waves className="h-5 w-5" />;
  return <Droplets className="h-5 w-5" />;
}

export default function ReadingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const readingId = Number(params.id);

  const utils = api.useUtils();
  const { data: reading, isLoading, error } = api.reading.get.useQuery(
    { id: readingId },
    { enabled: !isNaN(readingId) },
  );

  const deleteReading = api.reading.delete.useMutation({
    onSuccess: () => {
      router.push(reading ? `/properties/${reading.propertyId}` : "/readings");
      router.refresh();
    },
  });

  const updateReading = api.reading.update.useMutation({
    onSuccess: async () => {
      await utils.reading.get.invalidate({ id: readingId });
      setEditing(false);
    },
  });

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPhotos, setEditPhotos] = useState<UploadedPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Initialize edit state when reading loads
  useEffect(() => {
    if (reading && !editing) {
      setEditValue(String(reading.value));
      setEditDate(
        typeof reading.readingDate === "string"
          ? reading.readingDate.slice(0, 10)
          : new Date(reading.readingDate).toISOString().slice(0, 10),
      );
      setEditNotes(reading.notes ?? "");
      const existing = [
        ...(reading.photoUrl ? [reading.photoUrl] : []),
        ...(reading.photoUrls ?? []),
      ].filter((url, i, arr) => arr.indexOf(url) === i);
      setEditPhotos(existing.map((url) => ({ url, name: url.split("/").pop() ?? "fotó" })));
    }
  }, [reading, editing]);

  // Lightbox keyboard nav
  useEffect(() => {
    if (lightboxIndex === null || !reading) return;
    const photos = [
      ...(reading.photoUrl ? [reading.photoUrl] : []),
      ...(reading.photoUrls ?? []),
    ].filter((url, i, arr) => arr.indexOf(url) === i);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, reading]);

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Betöltés...</div>;
  }

  if (error || !reading) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{error?.message ?? "A leolvasás nem található"}</p>
        <Link href="/readings" className="mt-4 inline-block text-sm underline">
          Vissza a leolvasásokhoz
        </Link>
      </div>
    );
  }

  const unit = utilityUnits[reading.utilityType] ?? "";
  const photos = [
    ...(reading.photoUrl ? [reading.photoUrl] : []),
    ...(reading.photoUrls ?? []),
  ].filter((url, i, arr) => arr.indexOf(url) === i);

  const recorderName = reading.recorder
    ? [reading.recorder.firstName, reading.recorder.lastName].filter(Boolean).join(" ").trim() ||
      reading.recorder.email ||
      "Ismeretlen"
    : "—";

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleString("hu-HU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl p-2 hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <UtilityIcon type={reading.utilityType} />
          <h1 className="text-xl font-bold">
            {utilityLabels[reading.utilityType] ?? reading.utilityType} leolvasás
          </h1>
        </div>
      </div>

      {/* Main stats */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
        {!editing && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary"
            >
              <Pencil className="h-3 w-3" />
              Szerkesztés
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Mérőállás</p>
            {editing ? (
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-2xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {reading.value.toLocaleString("hu-HU")} {unit}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Fogyasztás</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {reading.consumption != null
                ? `${reading.consumption.toLocaleString("hu-HU")} ${unit}`
                : "—"}
            </p>
            {reading.prevValue != null && (
              <p className="text-xs text-muted-foreground">
                Előző: {reading.prevValue.toLocaleString("hu-HU")} {unit}
              </p>
            )}
          </div>
        </div>

        {editing && (
          <>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Dátum</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Megjegyzés</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <MultiPhotoUpload
              photos={editPhotos}
              onChange={setEditPhotos}
              folder="meter-readings"
              label="Fotók"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  updateReading.mutate({
                    id: reading.id,
                    value: Number(editValue),
                    readingDate: editDate,
                    notes: editNotes || null,
                    photoUrls: editPhotos.map((p) => p.url),
                  })
                }
                disabled={updateReading.isPending || !editValue}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {updateReading.isPending ? "Mentés..." : "Mentés"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={updateReading.isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Mégse
              </button>
            </div>
          </>
        )}

        {reading.costHuf != null && reading.costHuf > 0 && (
          <div className="border-t border-border/60 pt-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Becsült költség</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {Math.round(reading.costHuf).toLocaleString("hu-HU")} Ft
              {reading.tariff && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({reading.tariff.rateHuf} Ft/{reading.tariff.unit})
                </span>
              )}
            </p>
          </div>
        )}
      </section>

      {/* Meta */}
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Leolvasás dátuma:</span>
          <span className="font-medium">
            {new Date(reading.readingDate).toLocaleDateString("hu-HU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rögzítve:</span>
          <span className="font-medium">{formatDate(reading.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rögzítette:</span>
          <span className="font-medium">{recorderName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Forrás:</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            {sourceLabels[reading.source] ?? reading.source}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ingatlan:</span>
          <Link
            href={`/properties/${reading.propertyId}`}
            className="font-medium underline"
          >
            {reading.property?.name ?? "?"}
          </Link>
        </div>
        {reading.meterInfo && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mérő:</span>
              <span className="font-mono text-xs">
                {reading.meterInfo.serialNumber ?? "—"}
              </span>
            </div>
            {reading.meterInfo.location && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Helyszín:</span>
                <span className="font-medium">{reading.meterInfo.location}</span>
              </div>
            )}
          </>
        )}
      </section>

      {/* Notes */}
      {reading.notes && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Megjegyzés</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{reading.notes}</p>
        </section>
      )}

      {/* Photos */}
      {!editing && photos.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Fotók ({photos.length})
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((url, i) => (
              <button
                type="button"
                key={url}
                onClick={() => setLightboxIndex(i)}
                className="overflow-hidden rounded-lg border border-border transition hover:ring-2 hover:ring-primary"
              >
                <img
                  src={url}
                  alt={`Fotó ${i + 1}`}
                  className="h-32 w-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
          >
            <X className="h-5 w-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="absolute right-4 bottom-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:bottom-auto sm:right-16"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <img
            src={photos[lightboxIndex]}
            alt={`Fotó ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={photos[lightboxIndex]}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 left-4 text-xs text-white/60 underline"
            onClick={(e) => e.stopPropagation()}
          >
            Eredeti méret
          </a>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80">
            {lightboxIndex + 1} / {photos.length}
          </span>
        </div>
      )}

      {/* Actions */}
      {!editing && (
      <section className="flex gap-3 rounded-2xl border border-border bg-card p-4">
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => deleteReading.mutate({ id: reading.id })}
              disabled={deleteReading.isPending}
              className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleteReading.isPending ? "Törlés..." : "Biztosan törlöm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleteReading.isPending}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Mégse
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Leolvasás törlése
          </button>
        )}
      </section>
      )}
    </div>
  );
}
