"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Wrench,
  ShieldCheck,
  Hammer,
  Receipt,
  X,
  Upload,
  FileText,
  ImageIcon,
  ArrowLeft,
} from "lucide-react";

import { api } from "@/trpc/react";

type Category = "javitas" | "karbantartas" | "felujitas" | "csere";
type Priority = "low" | "normal" | "urgent";

const categoryCards: {
  value: Category;
  label: string;
  icon: typeof Wrench;
  color: string;
  selectedBg: string;
  selectedText: string;
  selectedRing: string;
}[] = [
  {
    value: "javitas",
    label: "Javitas",
    icon: Wrench,
    color: "text-primary",
    selectedBg: "bg-primary/10",
    selectedText: "text-primary",
    selectedRing: "ring-primary/40",
  },
  {
    value: "karbantartas",
    label: "Karbantartas",
    icon: ShieldCheck,
    color: "text-emerald-600",
    selectedBg: "bg-emerald-50 dark:bg-emerald-950/30",
    selectedText: "text-emerald-700 dark:text-emerald-300",
    selectedRing: "ring-emerald-400/50",
  },
  {
    value: "felujitas",
    label: "Felujitas",
    icon: Hammer,
    color: "text-amber-600",
    selectedBg: "bg-amber-50 dark:bg-amber-950/30",
    selectedText: "text-amber-700 dark:text-amber-300",
    selectedRing: "ring-amber-400/50",
  },
  {
    value: "csere",
    label: "Csere",
    icon: Receipt,
    color: "text-sky-600",
    selectedBg: "bg-sky-50 dark:bg-sky-950/30",
    selectedText: "text-sky-700 dark:text-sky-300",
    selectedRing: "ring-sky-400/50",
  },
];

const priorities: {
  value: Priority;
  label: string;
  className: string;
  selectedClassName: string;
}[] = [
  {
    value: "low",
    label: "Alacsony",
    className:
      "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30",
    selectedClassName:
      "bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-200",
  },
  {
    value: "normal",
    label: "Normal",
    className:
      "border-border text-foreground hover:bg-secondary",
    selectedClassName:
      "bg-secondary border-foreground/30 text-foreground",
  },
  {
    value: "urgent",
    label: "Surgos",
    className:
      "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30",
    selectedClassName:
      "bg-rose-100 border-rose-400 text-rose-800 dark:bg-rose-950/40 dark:border-rose-600 dark:text-rose-200",
  },
];

type UploadedFile = {
  url: string;
  name: string;
  preview?: string;
};

export default function NewMaintenancePage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const { data: property } = api.property.get.useQuery({ id: propertyId });

  const [category, setCategory] = useState<Category>("javitas");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [costHuf, setCostHuf] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [performedDate, setPerformedDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [documents, setDocuments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const createLog = api.maintenance.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const uploadFile = async (file: File, folder: string): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Upload failed");
    }

    const data = (await res.json()) as { url: string };
    return {
      url: data.url,
      name: file.name,
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
    };
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((f) => uploadFile(f, "maintenance")),
      );
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch {
      // silently ignore upload errors
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((f) => uploadFile(f, "maintenance")),
      );
      setDocuments((prev) => [...prev, ...uploaded]);
    } catch {
      // silently ignore upload errors
    } finally {
      setUploading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLog.mutate({
      propertyId,
      description,
      category,
      priority,
      costHuf: costHuf ? Number(costHuf) : undefined,
      performedBy: performedBy || undefined,
      performedDate: performedDate || undefined,
      photoUrls: photos.map((p) => p.url),
      documentUrls: documents.map((d) => d.url),
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push(`/properties/${propertyId}`)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Vissza
        </button>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Karbantartas rogzites
        </h1>
        {property && (
          <p className="mt-1 text-sm text-muted-foreground">
            {property.name}
            {property.address ? ` — ${property.address}` : ""}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Category cards */}
        <div>
          <label className="mb-3 block text-sm font-medium">
            Kategoria <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {categoryCards.map((cat) => {
              const Icon = cat.icon;
              const selected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-3 rounded-[24px] border p-4 text-left transition ${
                    selected
                      ? `ring-1 ${cat.selectedRing} ${cat.selectedBg} border-transparent`
                      : "border-border/60 bg-card hover:bg-secondary/50 ring-1 ring-border/60"
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      selected
                        ? `${cat.selectedBg} ${cat.selectedText}`
                        : `bg-secondary/50 ${cat.color}`
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      selected ? cat.selectedText : "text-foreground"
                    }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Leiras <span className="text-destructive">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Mi a problema? Mit kell csinalni?"
            className="w-full rounded-[16px] border border-border/60 bg-background px-4 py-3 text-sm ring-1 ring-border/60 transition focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="mb-3 block text-sm font-medium">Prioritas</label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition ${
                  priority === p.value ? p.selectedClassName : p.className
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cost + Date row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Koltseg (Ft)
            </label>
            <input
              type="number"
              value={costHuf}
              onChange={(e) => setCostHuf(e.target.value)}
              placeholder="0"
              className="w-full rounded-[16px] border border-border/60 bg-background px-4 py-3 text-sm ring-1 ring-border/60 transition focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Datum</label>
            <input
              type="date"
              value={performedDate}
              onChange={(e) => setPerformedDate(e.target.value)}
              className="w-full rounded-[16px] border border-border/60 bg-background px-4 py-3 text-sm ring-1 ring-border/60 transition focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Performed by */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Ki vegezte?
          </label>
          <input
            type="text"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            placeholder="pl. Kiss Janos villanyszerelo"
            className="w-full rounded-[16px] border border-border/60 bg-background px-4 py-3 text-sm ring-1 ring-border/60 transition focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Photos */}
        <div>
          <label className="mb-3 block text-sm font-medium">Fotok</label>
          <div className="rounded-[24px] border border-border/60 bg-card p-4 ring-1 ring-border/60">
            {photos.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {photos.map((photo, i) => (
                  <div key={i} className="group relative">
                    {photo.preview ? (
                      <img
                        src={photo.preview}
                        alt={photo.name}
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-secondary">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Feltöltés..." : "Galéria"}
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <ImageIcon className="h-4 w-4" />
                Kamera
              </button>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Documents */}
        <div>
          <label className="mb-3 block text-sm font-medium">
            Dokumentumok
          </label>
          <div className="rounded-[24px] border border-border/60 bg-card p-4 ring-1 ring-border/60">
            {documents.length > 0 && (
              <div className="mb-3 space-y-2">
                {documents.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {doc.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDocument(i)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Feltoltes..." : "Dokumentum hozzaadasa"}
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleDocUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            disabled={!description || createLog.isPending || uploading}
            className="rounded-2xl bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {createLog.isPending ? "Mentes..." : "Mentes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-2xl border border-border/70 px-8 py-3 text-sm font-medium transition hover:bg-secondary"
          >
            Megse
          </button>
        </div>
      </form>
    </div>
  );
}
