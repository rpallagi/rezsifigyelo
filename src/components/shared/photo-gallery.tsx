"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Camera,
  Trash2,
  Star,
  Eye,
} from "lucide-react";

export type Photo = {
  url: string;
  caption?: string;
};

export type PhotoGalleryProps = {
  photos: Photo[];
  onUpload?: (urls: string[]) => void;
  onRemove?: (url: string) => void;
  onUpdateCaption?: (url: string, caption: string) => void;
  onSetAvatar?: (url: string) => void;
  folder?: string;
  editable?: boolean;
  showCaptions?: boolean;
  showAvatarSelect?: boolean;
  avatarUrl?: string | null;
  columns?: 3 | 4 | 5;
};

async function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const MAX = maxSize;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Resize failed"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => reject(new Error("Kep betoltese sikertelen"));
    img.src = URL.createObjectURL(file);
  });
}

const colsClass: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-3 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5",
};

export function PhotoGallery({
  photos,
  onUpload,
  onRemove,
  onUpdateCaption,
  onSetAvatar,
  folder,
  editable = false,
  showCaptions = false,
  showAvatarSelect = false,
  avatarUrl,
  columns = 3,
}: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    if (photos[index]?.caption) {
      setEditingCaption(photos[index].caption ?? "");
    } else {
      setEditingCaption("");
    }
  }, [photos]);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    setEditingCaption("");
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null) return null;
      const next = prev < photos.length - 1 ? prev + 1 : 0;
      setEditingCaption(photos[next]?.caption ?? "");
      return next;
    });
  }, [photos]);

  const goPrev = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null) return null;
      const next = prev > 0 ? prev - 1 : photos.length - 1;
      setEditingCaption(photos[next]?.caption ?? "");
      return next;
    });
  }, [photos]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const resized = await resizeImage(file, 1600);
        const formData = new FormData();
        formData.append(
          "file",
          new File([resized], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
          }),
        );
        formData.append("folder", folder ?? "photos");
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = (await res.json()) as { url: string };
          urls.push(data.url);
        }
      } catch {
        // upload error silently ignored
      }
    }
    setUploading(false);
    if (urls.length > 0) onUpload?.(urls);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void uploadFiles(files);
    }
    e.target.value = "";
  };

  const currentPhoto =
    lightboxIndex !== null ? photos[lightboxIndex] : undefined;

  return (
    <>
      {/* Thumbnail grid */}
      <div className={`grid gap-3 ${colsClass[columns] ?? colsClass[3]}`}>
        {photos.map((photo, index) => (
          <div key={photo.url} className="space-y-1.5">
            <div className="group relative aspect-square overflow-hidden rounded-xl">
              <img
                src={photo.url}
                alt={photo.caption ?? ""}
                className="h-full w-full object-cover"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openLightbox(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/40"
                >
                  <Eye className="h-4 w-4" />
                </button>
                {editable && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(photo.url)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-rose-500/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Avatar star */}
              {showAvatarSelect && onSetAvatar && (
                <button
                  type="button"
                  onClick={() => onSetAvatar(photo.url)}
                  className="absolute left-2 top-2 z-10"
                >
                  <Star
                    className={`h-5 w-5 transition ${
                      avatarUrl === photo.url
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-white/60 hover:text-yellow-300"
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Caption below thumbnail */}
            {showCaptions && photo.caption && (
              <p className="truncate px-0.5 text-xs text-muted-foreground">
                {photo.caption}
              </p>
            )}
          </div>
        ))}

        {/* Upload buttons */}
        {editable && onUpload && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-xs">...</span>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Feltoltes</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-xs">...</span>
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Kamera</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Hidden file inputs */}
      {editable && onUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && currentPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Previous arrow */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Next arrow */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Image */}
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption ?? ""}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />

          {/* Caption area */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 p-4">
            {editable && onUpdateCaption ? (
              <input
                type="text"
                value={editingCaption}
                onChange={(e) => setEditingCaption(e.target.value)}
                onBlur={() => {
                  if (currentPhoto && editingCaption !== (currentPhoto.caption ?? "")) {
                    onUpdateCaption(currentPhoto.url, editingCaption);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Felirat hozzaadasa..."
                className="w-full max-w-lg bg-transparent text-sm text-white placeholder:text-white/50 outline-none border-b border-white/30 pb-1 focus:border-white/60"
              />
            ) : (
              currentPhoto.caption && (
                <p className="text-sm text-white">{currentPhoto.caption}</p>
              )
            )}
            {photos.length > 1 && (
              <p className="mt-2 text-xs text-white/60">
                {lightboxIndex + 1} / {photos.length}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
