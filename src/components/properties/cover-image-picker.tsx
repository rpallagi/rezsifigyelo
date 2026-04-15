"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, X, Trash2, Check } from "lucide-react";
import { api } from "@/trpc/react";

interface CoverImagePickerProps {
  propertyId: number;
  currentUrl: string | null;
  marketingPhotos: { url: string; filename: string }[];
}

async function resizeAndUpload(file: File, folder: string): Promise<string> {
  // Resize client-side (max 1200px, JPEG 0.85)
  const bitmap = await createImageBitmap(file);
  const maxDim = 1200;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });

  const formData = new FormData();
  formData.append("file", blob, file.name.replace(/\.\w+$/, ".jpg"));
  formData.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Feltöltés nem sikerült");
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function CoverImagePicker({ propertyId, currentUrl, marketingPhotos }: CoverImagePickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const updateProperty = api.property.update.useMutation({
    onSuccess: () => {
      setOpen(false);
      setSelectedUrl(null);
      router.refresh();
    },
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await resizeAndUpload(file, "property-avatars");
      await updateProperty.mutateAsync({ id: propertyId, avatarUrl: url });
    } catch {
      // error silently
    } finally {
      setUploading(false);
    }
  };

  const handleSelectMarketing = async (url: string) => {
    setSelectedUrl(url);
    await updateProperty.mutateAsync({ id: propertyId, avatarUrl: url });
  };

  const handleRemove = async () => {
    await updateProperty.mutateAsync({ id: propertyId, avatarUrl: "" });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/60"
      >
        <Camera className="h-3.5 w-3.5" />
        {currentUrl ? "Fotó módosítása" : "Fotó feltöltése"}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Popup */}
      <div className="absolute right-4 top-4 z-50 w-72 rounded-2xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Borítókép</p>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Upload buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-medium transition hover:bg-secondary disabled:opacity-50 sm:hidden"
          >
            <Camera className="h-4 w-4" />
            Fotózás
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-medium transition hover:bg-secondary disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4" />
            {uploading ? "Feltöltés..." : "Galéria"}
          </button>
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />

        {/* Marketing photos grid */}
        {marketingPhotos.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Marketing fotók ({marketingPhotos.length})
            </p>
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
              {marketingPhotos.map((photo) => (
                <button
                  key={photo.url}
                  type="button"
                  onClick={() => void handleSelectMarketing(photo.url)}
                  disabled={updateProperty.isPending}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition hover:opacity-80 ${
                    (selectedUrl === photo.url || currentUrl === photo.url) ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={photo.url} alt={photo.filename} className="h-full w-full object-cover" />
                  {currentUrl === photo.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Remove */}
        {currentUrl && (
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={updateProperty.isPending}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/30 py-2 text-xs text-destructive transition hover:bg-destructive/5 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Fotó eltávolítása
          </button>
        )}
      </div>
    </>
  );
}
