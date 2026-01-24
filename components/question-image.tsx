"use client";

import { useEffect, useState } from "react";
import type { Image as DbImage } from "@/lib/db/schema";

interface QuestionImageProps {
  image: DbImage;
  className?: string;
  alt?: string;
}

export function QuestionImage({ image, className = "", alt = "Изображение" }: QuestionImageProps) {
  // Create data URL from Base64
  const src = `data:${image.content_type};base64,${image.data}`;

  return (
    // biome-ignore lint/performance/noImgElement: Using data URL from IndexedDB, next/image doesn't support data URLs
    <img src={src} alt={alt} className={`max-w-full h-auto rounded ${className}`} loading="lazy" />
  );
}

interface QuestionImageByIdProps {
  imageId: string;
  className?: string;
  alt?: string;
}

export function QuestionImageById({
  imageId,
  className = "",
  alt = "Изображение",
}: QuestionImageByIdProps) {
  const [image, setImage] = useState<DbImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      try {
        const { getImage } = await import("@/lib/db/client");
        const img = await getImage(imageId);
        if (!cancelled) {
          setImage(img);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load image");
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  if (loading) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ minHeight: 100 }} />
    );
  }

  if (error || !image) {
    return (
      <div className={`bg-muted/50 rounded p-4 text-muted-foreground text-sm ${className}`}>
        Изображение не найдено
      </div>
    );
  }

  return <QuestionImage image={image} className={className} alt={alt} />;
}
