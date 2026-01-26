"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Image as DbImage } from "@/lib/db/encrypted-client";
import { decryptImageData } from "@/lib/db/encrypted-client";
import { useEncryptionStore } from "@/stores/encryption";

interface QuestionImageProps {
  image: DbImage;
  className?: string;
  alt?: string;
}

export function QuestionImage({ image, className = "", alt = "Изображение" }: QuestionImageProps) {
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const [decryptedSrc, setDecryptedSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function decryptImage() {
      if (!masterKey || !image.url) {
        setLoading(false);
        return;
      }

      try {
        // Fetch encrypted image data
        const response = await fetch(image.url);
        const encryptedData = await response.arrayBuffer();

        // Decrypt
        const decryptedData = await decryptImageData(masterKey, encryptedData, image.iv);

        // Create blob URL
        const blob = new Blob([decryptedData], { type: image.content_type });
        const url = URL.createObjectURL(blob);

        if (!cancelled) {
          urlRef.current = url;
          setDecryptedSrc(url);
          setLoading(false);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to decrypt image");
          setLoading(false);
        }
      }
    }

    decryptImage();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [masterKey, image.url, image.iv, image.content_type]);

  if (loading) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ minHeight: 100 }} />
    );
  }

  if (error || !decryptedSrc) {
    return (
      <div className={`bg-muted/50 rounded p-4 text-muted-foreground text-sm ${className}`}>
        {error || "Изображение не найдено"}
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: Using decrypted blob URL
    <img
      src={decryptedSrc}
      alt={alt}
      className={`max-w-full h-auto rounded ${className}`}
      loading="lazy"
    />
  );
}

interface QuestionImageByIdProps {
  imageId: Id<"images">;
  className?: string;
  alt?: string;
}

export function QuestionImageById({
  imageId,
  className = "",
  alt = "Изображение",
}: QuestionImageByIdProps) {
  const image = useQuery(api.images.get, { id: imageId });

  if (image === undefined) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ minHeight: 100 }} />
    );
  }

  if (!image) {
    return (
      <div className={`bg-muted/50 rounded p-4 text-muted-foreground text-sm ${className}`}>
        Изображение не найдено
      </div>
    );
  }

  const dbImage: DbImage = {
    id: image._id,
    question_id: image.questionId,
    url: image.url ?? "",
    iv: image.iv,
    content_type: image.contentType,
    filename: image.filename ?? null,
    created_at: image.createdAt,
  };

  return <QuestionImage image={dbImage} className={className} alt={alt} />;
}

interface QuestionImageByFilenameProps {
  questionId: Id<"questions">;
  filename: string;
  className?: string;
  alt?: string;
}

export function QuestionImageByFilename({
  questionId,
  filename,
  className = "",
  alt = "Изображение",
}: QuestionImageByFilenameProps) {
  const image = useQuery(api.images.getByFilename, { questionId, filename });

  if (image === undefined) {
    return (
      <div className={`bg-muted animate-pulse rounded ${className}`} style={{ minHeight: 100 }} />
    );
  }

  if (!image) {
    return (
      <div className={`bg-muted/50 rounded p-4 text-muted-foreground text-sm ${className}`}>
        Изображение не найдено: {filename}
      </div>
    );
  }

  const dbImage: DbImage = {
    id: image._id,
    question_id: image.questionId,
    url: image.url ?? "",
    iv: image.iv,
    content_type: image.contentType,
    filename: image.filename ?? null,
    created_at: image.createdAt,
  };

  return <QuestionImage image={dbImage} className={className} alt={alt} />;
}
