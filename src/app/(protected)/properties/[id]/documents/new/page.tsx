"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { MultiPhotoUpload, type UploadedPhoto } from "@/components/shared/multi-photo-upload";

const categoryLabels: Record<string, string> = {
  szerzodes: "Szerződés",
  atadas_atvetel: "Átadás-átvétel",
  marketing: "Marketing",
  egyeb: "Egyéb",
};

export default function NewDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [files, setFiles] = useState<UploadedPhoto[]>([]);
  const [category, setCategory] = useState("egyeb");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const createDocument = api.document.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setSubmitting(true);
    setError("");
    try {
      // Create one document record per uploaded file
      for (const f of files) {
        await createDocument.mutateAsync({
          propertyId,
          filename: f.name,
          storedUrl: f.url,
          category: category as "egyeb",
          notes: notes || undefined,
        });
      }
      router.push(`/properties/${propertyId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Dokumentum feltöltés</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <MultiPhotoUpload
          photos={files}
          onChange={setFiles}
          folder="documents"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          label="Fájlok *"
        />
        <p className="text-xs text-muted-foreground">Képek, PDF vagy Office fájlok — max 10 MB / db</p>

        <div>
          <label className="block text-sm font-medium">Kategória</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  category === key
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
          <label className="block text-sm font-medium">Megjegyzés</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={files.length === 0 || submitting}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Mentés..." : `Mentés (${files.length})`}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
