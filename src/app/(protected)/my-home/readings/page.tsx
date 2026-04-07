"use client";

import { useState, useRef } from "react";
import { api } from "@/trpc/react";

const utilityLabels: Record<string, string> = {
  villany: "Villany",
  viz: "Víz",
  gaz: "Gáz",
  csatorna: "Csatorna",
};

export default function TenantReadingsPage() {
  const [utilityType, setUtilityType] = useState("villany");
  const [value, setValue] = useState("");
  const [readingDate, setReadingDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [ocrLoading, setOcrLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TODO: Get tenant's property ID from tenancy
  const propertyId = 1; // placeholder

  const createReading = api.reading.record.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setValue("");
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.value != null) {
        setValue(data.value.toString());
      }
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
      source: "tenant",
    });
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Mérőállás rögzítés</h1>

      {success && (
        <div className="mt-4 rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
          Sikeresen rögzítve!
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">Közmű</label>
          <div className="mt-2 flex gap-2">
            {Object.entries(utilityLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setUtilityType(key)}
                className={`flex-1 rounded-md border py-2 text-sm ${
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
        <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
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
            className="rounded-md bg-secondary px-6 py-3 text-sm hover:bg-secondary/80 disabled:opacity-50"
          >
            {ocrLoading ? "Feldolgozás..." : "Fotó készítés"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Fotózd le a mérőórát
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Mérőállás</label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="pl. 12345"
            required
            className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Dátum</label>
          <input
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={!value || createReading.isPending}
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createReading.isPending ? "Mentés..." : "Rögzítés"}
        </button>
      </form>
    </div>
  );
}
