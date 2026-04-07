"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

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

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("egyeb");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const createDocument = api.document.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const data = await res.json();

      createDocument.mutate({
        propertyId,
        filename: data.filename,
        storedUrl: data.url,
        category: category as "egyeb",
        notes: notes || undefined,
        fileSize: data.size,
        mimeType: data.type,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feltöltési hiba");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Dokumentum feltöltés</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">
            Fájl <span className="text-destructive">*</span>
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Max 10 MB</p>
        </div>

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
            disabled={!file || uploading || createDocument.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading
              ? "Feltöltés..."
              : createDocument.isPending
                ? "Mentés..."
                : "Feltöltés"}
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
