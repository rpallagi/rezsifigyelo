"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Wrench,
  ShieldCheck,
  Hammer,
  Receipt,
  ArrowLeft,
  Upload,
  Trash2,
  Check,
  Play,
  X,
  FileText,
  ImageIcon,
  Building2,
} from "lucide-react";

import { api } from "@/trpc/react";

type MaintenanceCategory = "javitas" | "karbantartas" | "felujitas" | "csere";
type MaintenanceStatus = "pending" | "in_progress" | "done";

function normalizeCategory(raw: string | null | undefined): MaintenanceCategory {
  const value = raw?.toLowerCase() ?? "";
  if (value.includes("karbant") || value.includes("tiszt") || value.includes("szerv"))
    return "karbantartas";
  if (value.includes("feluj") || value.includes("fest") || value.includes("butor"))
    return "felujitas";
  if (value.includes("csere") || value.includes("villany")) return "csere";
  return "javitas";
}

function categoryMeta(category: MaintenanceCategory) {
  switch (category) {
    case "javitas":
      return {
        label: "Javítás",
        badge: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-foreground",
        icon: Wrench,
      };
    case "karbantartas":
      return {
        label: "Karbantartás",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        icon: ShieldCheck,
      };
    case "felujitas":
      return {
        label: "Felújítás",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
        icon: Hammer,
      };
    case "csere":
      return {
        label: "Csere",
        badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
        icon: Receipt,
      };
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "low":
      return {
        label: "Alacsony",
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
    case "urgent":
      return {
        label: "Sürgős",
        className: "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
      };
    default:
      return {
        label: "Normál",
        className: "bg-secondary text-muted-foreground",
      };
  }
}

function statusBadge(status: MaintenanceStatus) {
  switch (status) {
    case "pending":
      return {
        label: "Függőben",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
      };
    case "in_progress":
      return {
        label: "Folyamatban",
        className: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
      };
    case "done":
      return {
        label: "Kész",
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
  }
}

function formatCurrencyHu(value: number) {
  return new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 }).format(value);
}

function formatDateHu(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("hu-HU");
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const { data: log, isLoading, error } = api.maintenance.get.useQuery(
    { id },
    { enabled: !Number.isNaN(id) },
  );

  const utils = api.useUtils();

  const markInProgress = api.maintenance.markInProgress.useMutation({
    onSuccess: async () => {
      await utils.maintenance.get.invalidate({ id });
    },
  });

  const markCompleted = api.maintenance.markCompleted.useMutation({
    onSuccess: async () => {
      await utils.maintenance.get.invalidate({ id });
    },
  });

  const deleteMutation = api.maintenance.delete.useMutation({
    onSuccess: () => {
      router.push("/maintenance");
    },
  });

  const updateMutation = api.maintenance.update.useMutation({
    onSuccess: async () => {
      await utils.maintenance.get.invalidate({ id });
    },
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const anyPending =
    markInProgress.isPending ||
    markCompleted.isPending ||
    deleteMutation.isPending ||
    updateMutation.isPending;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !log) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "maintenance");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const payload = (await res.json()) as { url: string };
      const currentPhotos = (log as Record<string, unknown>).photoUrls as string[] ?? [];
      updateMutation.mutate({ id, photoUrls: [...currentPhotos, payload.url] });
    } catch {
      // upload error silently ignored
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !log) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "maintenance");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const payload = (await res.json()) as { url: string };
      const currentDocs = (log as Record<string, unknown>).documentUrls as string[] ?? [];
      updateMutation.mutate({ id, documentUrls: [...currentDocs, payload.url] });
    } catch {
      // upload error silently ignored
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const removePhoto = (url: string) => {
    if (!log) return;
    const currentPhotos = (log as Record<string, unknown>).photoUrls as string[] ?? [];
    updateMutation.mutate({ id, photoUrls: currentPhotos.filter((u) => u !== url) });
  };

  const removeDoc = (url: string) => {
    if (!log) return;
    const currentDocs = (log as Record<string, unknown>).documentUrls as string[] ?? [];
    updateMutation.mutate({ id, documentUrls: currentDocs.filter((u) => u !== url) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">Betöltés...</p>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground">Nem található karbantartási bejegyzés.</p>
        <Link
          href="/maintenance"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Vissza
        </Link>
      </div>
    );
  }

  const category = normalizeCategory(
    (log as Record<string, unknown>).category as string | null,
  );
  const status = ((log as Record<string, unknown>).status as MaintenanceStatus) ?? "pending";
  const priority = ((log as Record<string, unknown>).priority as string) ?? "normal";
  const photoUrls = ((log as Record<string, unknown>).photoUrls as string[]) ?? [];
  const documentUrls = ((log as Record<string, unknown>).documentUrls as string[]) ?? [];
  const costHuf = Math.round(((log as Record<string, unknown>).costHuf as number) ?? 0);
  const performedBy = log.performedBy ?? null;
  const performedDate = log.performedDate ?? null;
  const createdAt = (log as Record<string, unknown>).createdAt as string | undefined;

  const catMeta = categoryMeta(category);
  const CatIcon = catMeta.icon;
  const pBadge = priorityBadge(priority);
  const sBadge = statusBadge(status);

  const property = (log as Record<string, unknown>).property as
    | { id: number; name: string; address?: string | null }
    | null
    | undefined;

  // Timeline steps
  const timelineSteps = [
    {
      label: "Bejelentve",
      date: formatDateHu(createdAt ?? null),
      active: true,
    },
    {
      label: "Folyamatban",
      date: status === "in_progress" || status === "done" ? null : null,
      active: status === "in_progress" || status === "done",
    },
    {
      label: "Kész",
      date: formatDateHu(performedDate),
      active: status === "done",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Link
          href="/maintenance"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Vissza
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {status === "pending" && (
            <button
              type="button"
              onClick={() => markInProgress.mutate({ id })}
              disabled={anyPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
            >
              <Play className="h-4 w-4" />
              Folyamatban
            </button>
          )}
          {status !== "done" && (
            <button
              type="button"
              onClick={() => markCompleted.mutate({ id })}
              disabled={anyPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              <Check className="h-4 w-4" />
              Kész
            </button>
          )}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={anyPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <Trash2 className="h-4 w-4" />
              Törlés
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-rose-600">Biztosan törlöd?</span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate({ id })}
                disabled={anyPending}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Igen
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Mégse
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title + badges */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${catMeta.badge}`}>
            <CatIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {log.description}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${catMeta.badge}`}
              >
                {catMeta.label}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${pBadge.className}`}
              >
                {pBadge.label}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${sBadge.className}`}
              >
                {sBadge.label}
              </span>
              <span className="text-xs text-muted-foreground">#LOG-{log.id}</span>
            </div>
          </div>
        </div>

        {/* Property link */}
        {property && (
          <Link
            href={`/properties/${property.id}`}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card/90 px-4 py-2.5 text-sm font-medium transition hover:bg-secondary"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{property.name}</span>
            <span className="text-muted-foreground">&rarr;</span>
          </Link>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-[24px] border border-border/60 bg-card/90 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Idősor
        </h2>
        <div className="relative ml-3 space-y-0">
          {timelineSteps.map((step, idx) => {
            const isLast = idx === timelineSteps.length - 1;
            return (
              <div key={step.label} className="relative flex items-start gap-4 pb-6">
                {/* Vertical line */}
                {!isLast && (
                  <div
                    className={`absolute left-[7px] top-5 h-full w-0.5 ${
                      timelineSteps[idx + 1]?.active
                        ? "bg-emerald-400 dark:bg-emerald-600"
                        : "bg-border"
                    }`}
                  />
                )}
                {/* Dot */}
                <div
                  className={`relative z-10 mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                    step.active
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-border bg-background"
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      step.active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.date && (
                    <p className="text-xs text-muted-foreground">{step.date}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details — editable */}
      <div className="rounded-[24px] border border-border/60 bg-card/90 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Részletek
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Költség (Ft)
            </label>
            <input
              type="number"
              defaultValue={costHuf || ""}
              placeholder="0"
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val !== costHuf) {
                  updateMutation.mutate({ id: id, costHuf: val });
                }
              }}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ki végezte
            </label>
            <input
              type="text"
              defaultValue={performedBy ?? ""}
              placeholder="pl. Víz-Gáz Kft."
              onBlur={(e) => {
                const val = e.target.value;
                if (val !== (performedBy ?? "")) {
                  updateMutation.mutate({ id: id, performedBy: val || undefined });
                }
              }}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Elvégzés dátuma
            </label>
            <input
              type="date"
              defaultValue={performedDate ?? ""}
              onBlur={(e) => {
                const val = e.target.value;
                if (val !== (performedDate ?? "")) {
                  updateMutation.mutate({ id: id, performedDate: val || undefined });
                }
              }}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="rounded-[24px] border border-border/60 bg-card/90 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Fotók
        </h2>
        <div className="flex flex-wrap gap-3">
          {photoUrls.map((url) => (
            <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-border/60">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white group-hover:inline-flex"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploadingPhoto ? (
              <span className="text-xs">...</span>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span className="text-[10px] font-medium">Feltöltés</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploadingPhoto ? (
              <span className="text-xs">...</span>
            ) : (
              <>
                <ImageIcon className="h-5 w-5" />
                <span className="text-[10px] font-medium">Kamera</span>
              </>
            )}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-[24px] border border-border/60 bg-card/90 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dokumentumok
        </h2>
        <div className="space-y-2">
          {documentUrls.map((url) => {
            const fileName = url.split("/").pop() ?? url;
            return (
              <div
                key={url}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-sm font-medium hover:underline"
                >
                  {fileName}
                </a>
                <button
                  type="button"
                  onClick={() => removeDoc(url)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={uploadingDoc}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploadingDoc ? (
              <span>Feltöltés...</span>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Dokumentum feltöltés
              </>
            )}
          </button>
          <input
            ref={docInputRef}
            type="file"
            className="hidden"
            onChange={handleDocUpload}
          />
        </div>
      </div>
    </div>
  );
}
