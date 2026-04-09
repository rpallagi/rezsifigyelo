"use client";

import { useEffect, useState } from "react";

type PropertyCoverImageProps = {
  imageUrl?: string | null;
  title: string;
  className?: string;
  placeholderClassName?: string;
  placeholderBackground: string;
};

export function PropertyCoverImage({
  imageUrl,
  title,
  className = "",
  placeholderClassName = "",
  placeholderBackground,
}: PropertyCoverImageProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl]);

  if (!imageUrl || hasImageError) {
    return (
      <div
        className={placeholderClassName}
        style={{ background: placeholderBackground }}
        aria-label={title}
      />
    );
  }

  return (
    <img
      src={imageUrl}
      alt={title}
      className={className}
      onError={() => setHasImageError(true)}
    />
  );
}
