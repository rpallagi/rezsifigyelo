"use client";

import { useRef, useState } from "react";
import { Camera, ImageIcon, X, Loader2 } from "lucide-react";

export type UploadedPhoto = {
  url: string;
  name: string;
  preview?: string;
};

interface MultiPhotoUploadProps {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  folder: string;
  accept?: string;
  maxPhotos?: number;
  label?: string;
}

export function MultiPhotoUpload({
  photos,
  onChange,
  folder,
  accept = "image/*",
  maxPhotos,
  label = "Fotók",
}: MultiPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const uploadOne = async (file: File): Promise<UploadedPhoto> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Upload hiba (${res.status})`);
    }
    const data = (await res.json()) as { url: string; filename?: string };
    return {
      url: data.url,
      name: data.filename ?? file.name,
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
    };
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    const remaining = maxPhotos ? Math.max(0, maxPhotos - photos.length) : files.length;
    const selected = Array.from(files).slice(0, remaining);
    try {
      const uploaded = await Promise.all(selected.map(uploadOne));
      onChange([...photos, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feltöltési hiba");
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  const canAddMore = !maxPhotos || photos.length < maxPhotos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {maxPhotos && (
          <span className="text-xs text-muted-foreground">
            {photos.length} / {maxPhotos}
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div
              key={`${p.url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/50"
            >
              {p.preview || p.url.match(/\.(jpe?g|png|webp|gif)/i) ? (
                <img
                  src={p.preview ?? p.url}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
                  {p.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Törlés"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAddMore && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary/50 disabled:opacity-50 sm:hidden"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Fénykép
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary/50 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            {photos.length === 0 ? "Fájlok kiválasztása" : "További hozzáadása"}
          </button>
        </div>
      )}

      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
