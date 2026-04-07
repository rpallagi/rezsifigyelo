"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Víz",
  gaz: "Gáz",
  csatorna: "Csatorna",
  internet: "Internet",
  kozos_koltseg: "Közös költség",
  egyeb: "Egyéb",
};

export default function NewReadingPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [utilityType, setUtilityType] = useState<string>("villany");
  const [value, setValue] = useState("");
  const [readingDate, setReadingDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [notes, setNotes] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createReading = api.reading.record.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleOCR = async (file: File) => {
    setOcrLoading(true);
    setOcrError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.value != null) {
        setValue(data.value.toString());
        setOcrError("");
      } else {
        setOcrError(data.error ?? "OCR sikertelen");
      }
    } catch {
      setOcrError("Hiba a fotó feldolgozásakor");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReading.mutate({
      propertyId,
      utilityType: utilityType as "villany",
      value: Number(value),
      readingDate,
      notes: notes || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Mérőállás rögzítés</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Utility type */}
        <div>
          <label className="block text-sm font-medium">Közmű típus</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(utilityLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setUtilityType(key)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  utilityType === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* OCR */}
        <div className="rounded-lg border-2 border-dashed border-border p-4">
          <p className="text-sm font-medium">Fotóból leolvasás (OCR)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Készíts fotót a mérőóráról — automatikusan leolvassuk az állást
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleOCR(f);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading}
            className="mt-3 rounded-md bg-secondary px-4 py-2 text-sm hover:bg-secondary/80 disabled:opacity-50"
          >
            {ocrLoading ? "Feldolgozás..." : "Fotó készítés / Feltöltés"}
          </button>
          {ocrError && (
            <p className="mt-2 text-xs text-destructive">{ocrError}</p>
          )}
        </div>

        {/* Value */}
        <div>
          <label className="block text-sm font-medium">
            Mérőállás <span className="text-destructive">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="pl. 12345.67"
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium">Dátum</label>
          <input
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium">Megjegyzés</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!value || createReading.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createReading.isPending ? "Mentés..." : "Rögzítés"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>

        {createReading.error && (
          <p className="text-sm text-destructive">
            Hiba: {createReading.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
