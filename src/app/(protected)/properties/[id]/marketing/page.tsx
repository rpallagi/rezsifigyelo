"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  ExternalLink,
  FileImage,
  ImagePlus,
  Link2,
  Loader2,
  Map,
  Save,
  Trash2,
} from "lucide-react";

import { api } from "@/trpc/react";
import { PropertyCoverImage } from "@/components/properties/property-cover-image";

type MarketingMeta = {
  kind: "photo" | "floorplan";
  room?: string;
  view?: string;
  shotDate?: string;
};

function propertyTypeLabel(propertyType?: string) {
  const builtIn: Record<string, string> = {
    lakas: "Lakás", uzlet: "Üzlet", telek: "Telek", egyeb: "Egyéb",
  };
  return builtIn[propertyType ?? ""] ?? propertyType ?? "Egyéb";
}

function propertyPlaceholder(propertyType?: string) {
  switch (propertyType) {
    case "lakas":
      return "linear-gradient(135deg, rgba(70,72,212,0.92), rgba(96,99,238,0.75)), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 42%)";
    case "uzlet":
      return "linear-gradient(135deg, rgba(0,108,73,0.92), rgba(108,248,187,0.68)), radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 40%)";
    case "telek":
      return "linear-gradient(135deg, rgba(131,81,0,0.9), rgba(255,185,95,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 40%)";
    default:
      return "linear-gradient(135deg, rgba(25,28,30,0.9), rgba(118,117,134,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 42%)";
  }
}

function parseMarketingMeta(notes?: string | null): MarketingMeta | null {
  if (!notes) return null;

  try {
    const parsed: unknown = JSON.parse(notes);
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as Record<string, unknown>;
    if (candidate.kind !== "photo" && candidate.kind !== "floorplan") return null;

    return {
      kind: candidate.kind,
      room: typeof candidate.room === "string" ? candidate.room : undefined,
      view: typeof candidate.view === "string" ? candidate.view : undefined,
      shotDate: typeof candidate.shotDate === "string" ? candidate.shotDate : undefined,
    };
  } catch {
    return null;
  }
}

function todayString() {
  return new Date().toISOString().split("T")[0]!;
}

export default function MarketingPage() {
  const params = useParams();
  const propertyId = Number(params.id);
  const utils = api.useUtils();

  const { data: property } = api.property.get.useQuery({ id: propertyId });
  const { data: marketing, isLoading: marketingLoading } = api.marketing.get.useQuery({ propertyId });
  const { data: documents, isLoading: docsLoading } = api.document.list.useQuery({ propertyId });

  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadKind, setUploadKind] = useState<"photo" | "floorplan">("photo");
  const [roomLabel, setRoomLabel] = useState("");
  const [viewLabel, setViewLabel] = useState("");
  const [shotDate, setShotDate] = useState(todayString());
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");

  useEffect(() => {
    if (marketing) {
      setListingTitle(marketing.listingTitle ?? "");
      setListingDescription(marketing.listingDescription ?? "");
      setListingUrl(marketing.listingUrl ?? "");
      return;
    }

    setListingTitle("");
    setListingDescription("");
    setListingUrl("");
  }, [marketing]);

  const saveMarketing = api.marketing.upsert.useMutation({
    onSuccess: async () => {
      setSaved(true);
      setSaveError("");
      await utils.marketing.get.invalidate({ propertyId });
    },
    onError: (error) => {
      setSaveError(error.message);
      setSaved(false);
    },
  });

  const createDocument = api.document.create.useMutation({
    onSuccess: async () => {
      await utils.document.list.invalidate({ propertyId });
    },
  });

  const deleteDocument = api.document.delete.useMutation({
    onSuccess: async () => {
      await utils.document.list.invalidate({ propertyId });
    },
  });

  const marketingDocs = (documents ?? []).filter((doc) => doc.category === "marketing");
  const photoDocs = marketingDocs.filter((doc) => parseMarketingMeta(doc.notes)?.kind !== "floorplan");
  const floorplanDocs = marketingDocs.filter((doc) => parseMarketingMeta(doc.notes)?.kind === "floorplan");

  const handleSaveMarketing = async () => {
    setSaved(false);
    await saveMarketing.mutateAsync({
      propertyId,
      listingTitle: listingTitle || undefined,
      listingDescription: listingDescription || undefined,
      listingUrl: listingUrl || undefined,
    });
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;

    setUploadError("");
    setUploading(true);

    try {
      for (const uploadFile of uploadFiles) {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("folder", `marketing/${propertyId}/${shotDate}`);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadPayload: unknown = await uploadRes.json();

      if (!uploadRes.ok) {
        if (
          uploadPayload &&
          typeof uploadPayload === "object" &&
          "error" in uploadPayload &&
          typeof uploadPayload.error === "string"
        ) {
          throw new Error(uploadPayload.error);
        }
        throw new Error("A feltöltés nem sikerült.");
      }

      if (
        !uploadPayload ||
        typeof uploadPayload !== "object" ||
        !("url" in uploadPayload) ||
        typeof uploadPayload.url !== "string" ||
        !("filename" in uploadPayload) ||
        typeof uploadPayload.filename !== "string"
      ) {
        throw new Error("Érvénytelen feltöltési válasz.");
      }

      const metadata: MarketingMeta = {
        kind: uploadKind,
        room: roomLabel || undefined,
        view: viewLabel || undefined,
        shotDate,
      };

      await createDocument.mutateAsync({
        propertyId,
        filename: uploadPayload.filename,
        storedUrl: uploadPayload.url,
        category: "marketing",
        notes: JSON.stringify(metadata),
        fileSize:
          "size" in uploadPayload && typeof uploadPayload.size === "number"
            ? uploadPayload.size
            : undefined,
        mimeType:
          "type" in uploadPayload && typeof uploadPayload.type === "string"
            ? uploadPayload.type
            : undefined,
      });
      } // end for loop

      setUploadFiles([]);
      setLocalPreviewUrl("");
      setRoomLabel("");
      setViewLabel("");
      setShotDate(todayString());
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "A feltöltés nem sikerült.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="text-2xl font-bold">Marketing — {property?.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hirdetési szöveg, URL, marketing fotók és alaprajz kezelése.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="relative aspect-[4/3] overflow-hidden">
            <PropertyCoverImage
              imageUrl={property?.avatarUrl}
              title={property?.name ?? "Ingatlan"}
              className="absolute inset-0 h-full w-full object-cover"
              placeholderClassName="absolute inset-0 h-full w-full"
              placeholderBackground={propertyPlaceholder(property?.propertyType)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            <div className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900 shadow-sm">
              {propertyTypeLabel(property?.propertyType)}
            </div>
            <div className="absolute inset-x-4 bottom-4">
              <p className="text-lg font-semibold tracking-tight text-white">{property?.name}</p>
              <p className="mt-1 text-xs text-white/72">
                {property?.address || "Nincs cím megadva"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Save className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Hirdetés tartalma</h2>
              <p className="text-sm text-muted-foreground">
                Ezek mennek az ingatlan.com / FB / saját listing szövegekhez.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium">Hirdetés címe</label>
              <input
                type="text"
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
                placeholder="pl. Felújított 2 szobás lakás a belvárosban"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Hirdetés szövege</label>
              <textarea
                value={listingDescription}
                onChange={(e) => setListingDescription(e.target.value)}
                rows={10}
                placeholder="Részletes leírás..."
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Hirdetés URL</label>
              <div className="relative mt-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="https://ingatlan.com/..."
                  className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveMarketing()}
                disabled={saveMarketing.isPending || marketingLoading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saveMarketing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Mentés
              </button>
              {saved ? <p className="text-sm text-emerald-600">Mentve.</p> : null}
              {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Fotó / alaprajz feltöltés</h2>
              <p className="text-sm text-muted-foreground">
                Dátum szerint mappázva, helyiség és nézet meta címkével.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium">Típus</label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadKind("photo")}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    uploadKind === "photo"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  Fotó
                </button>
                <button
                  type="button"
                  onClick={() => setUploadKind("floorplan")}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    uploadKind === "floorplan"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  Alaprajz
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">
                Fájl <span className="text-destructive">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={uploadKind === "floorplan" ? ".pdf,image/*" : undefined}
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  setUploadFiles(files);
                  const first = files[0];
                  setLocalPreviewUrl(first && first.type.startsWith("image/") ? URL.createObjectURL(first) : "");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 cursor-pointer overflow-hidden rounded-2xl border border-dashed border-border bg-background/70 transition hover:bg-secondary/40"
              >
                <div className="grid min-h-[220px] place-items-center p-4">
                  {localPreviewUrl ? (
                    <div className="w-full">
                      <div className="relative mx-auto aspect-[4/3] max-w-xs overflow-hidden rounded-2xl bg-muted">
                        <img src={localPreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900 shadow-sm">
                          {uploadKind === "photo" ? "Fotó" : "Alaprajz"}
                        </div>
                      </div>
                      <p className="mt-3 text-center text-sm font-medium">{uploadFiles.length > 1 ? `${uploadFiles.length} fájl kiválasztva` : uploadFiles[0]?.name}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {uploadKind === "photo" ? <Camera className="h-6 w-6" /> : <Map className="h-6 w-6" />}
                      </div>
                      <p className="mt-4 text-sm font-semibold">
                        {uploadKind === "photo" ? "Marketing fotó kiválasztása" : "Alaprajz kiválasztása"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Thumbnail previewvel fog megjelenni a listában.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Szoba / hely</label>
                <input
                  type="text"
                  value={roomLabel}
                  onChange={(e) => setRoomLabel(e.target.value)}
                  placeholder="pl. nappali, háló, konyha, folyosó"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Nézet</label>
                <input
                  type="text"
                  value={viewLabel}
                  onChange={(e) => setViewLabel(e.target.value)}
                  placeholder="pl. utcafront, erkély, külső homlokzat"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Dátum</label>
              <input
                type="date"
                value={shotDate}
                onChange={(e) => setShotDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploadFiles.length === 0 || uploading || createDocument.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading || createDocument.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : uploadKind === "photo" ? (
                <Camera className="h-4 w-4" />
              ) : (
                <Map className="h-4 w-4" />
              )}
              {uploadKind === "photo" ? "Fotó feltöltése" : "Alaprajz feltöltése"}
            </button>

            {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileImage className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Marketing fotók</h2>
            <p className="text-sm text-muted-foreground">
              Az upload mappa automatikusan `marketing/{propertyId}/{shotDate}` szerint szerveződik.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docsLoading ? (
            <p className="text-sm text-muted-foreground">Betöltés...</p>
          ) : photoDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Még nincs marketing fotó feltöltve ehhez az ingatlanhoz.
            </p>
          ) : (
            photoDocs.map((doc) => {
              const meta = parseMarketingMeta(doc.notes);
              return (
                <div key={doc.id} className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {doc.mimeType?.startsWith("image/") ? (
                      <img src={doc.storedUrl} alt={doc.filename} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Nem képfájl
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="truncate text-sm font-semibold">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {meta?.shotDate || new Date(doc.uploadedAt).toLocaleDateString("hu-HU")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                        {propertyTypeLabel(property?.propertyType)}
                      </span>
                      {meta?.room ? (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium">
                          {meta.room}
                        </span>
                      ) : null}
                      {meta?.view ? (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium">
                          {meta.view}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={doc.storedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Megnyitás
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteDocument.mutate({ id: doc.id })}
                        className="inline-flex items-center gap-1 text-sm text-destructive hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Törlés
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Map className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Alaprajzok</h2>
            <p className="text-sm text-muted-foreground">
              Ide kerülhet PDF vagy kép formátumú alaprajz.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {floorplanDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Még nincs alaprajz feltöltve.
            </p>
          ) : (
            floorplanDocs.map((doc) => {
              const meta = parseMarketingMeta(doc.notes);
              return (
                <div
                  key={doc.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm md:flex-row md:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold">{doc.filename}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {meta?.shotDate || new Date(doc.uploadedAt).toLocaleDateString("hu-HU")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                        {propertyTypeLabel(property?.propertyType)}
                      </span>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium">
                        Alaprajz
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={doc.storedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Megnyitás
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteDocument.mutate({ id: doc.id })}
                      className="inline-flex items-center gap-1 text-sm text-destructive hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Törlés
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
