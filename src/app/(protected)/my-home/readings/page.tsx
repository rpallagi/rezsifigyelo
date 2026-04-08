"use client";

import { useState, useRef } from "react";
import { api } from "@/trpc/react";
import { useLocale } from "@/components/providers/locale-provider";

export default function TenantReadingsPage() {
  const { messages, utilityLabel } = useLocale();
  const [utilityType, setUtilityType] = useState("villany");
  const [value, setValue] = useState("");
  const [readingDate, setReadingDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [ocrLoading, setOcrLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: activeTenancy, isLoading: tenancyLoading } =
    api.tenancy.myActive.useQuery();

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
      setUploadingPhoto(true);
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("folder", "meter-readings");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });
      if (uploadRes.ok) {
        const uploaded: unknown = await uploadRes.json();
        if (
          typeof uploaded === "object" &&
          uploaded !== null &&
          "url" in uploaded &&
          typeof uploaded.url === "string"
        ) {
          setPhotoUrl(uploaded.url);
        }
      }

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data: unknown = await res.json();
      if (
        typeof data === "object" &&
        data !== null &&
        "success" in data &&
        data.success === true &&
        "value" in data &&
        typeof data.value === "number"
      ) {
        setValue(data.value.toString());
      }
    } finally {
      setOcrLoading(false);
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenancy) return;

    createReading.mutate({
      propertyId: activeTenancy.propertyId,
      utilityType: utilityType as "villany",
      value: Number(value),
      readingDate,
      photoUrl,
      source: "tenant",
    });
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">{messages.tenantShell.recordReading}</h1>

      {tenancyLoading && (
        <p className="mt-4 text-sm text-muted-foreground">{messages.common.loading}</p>
      )}

      {!tenancyLoading && !activeTenancy && (
        <div className="mt-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
          {messages.tenantShell.noTenancy}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
          {messages.tenantShell.success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">{messages.tenantShell.utility}</label>
          <div className="mt-2 flex gap-2">
            {(["villany", "viz", "gaz", "csatorna"] as const).map((key) => (
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
                {utilityLabel(key)}
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
            disabled={ocrLoading || uploadingPhoto}
            className="rounded-md bg-secondary px-6 py-3 text-sm hover:bg-secondary/80 disabled:opacity-50"
          >
            {ocrLoading || uploadingPhoto
              ? messages.tenantShell.processing
              : messages.tenantShell.takePhoto}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            {messages.tenantShell.takePhotoHint}
          </p>
          {photoUrl && (
            <a
              href={photoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs text-primary hover:underline"
            >
              {messages.tenantShell.photoStored}
            </a>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">{messages.tenantShell.readingValue}</label>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={messages.tenantShell.readingPlaceholder}
            required
            className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">{messages.common.date}</label>
          <input
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={!value || createReading.isPending || !activeTenancy}
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createReading.isPending ? messages.tenantShell.saving : messages.tenantShell.submit}
        </button>
      </form>
    </div>
  );
}
