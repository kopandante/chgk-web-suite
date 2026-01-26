"use client";

import { useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type Image as DbImage,
  decryptImageData,
  encryptImageBinary,
} from "@/lib/db/encrypted-client";
import { useEncryptionStore } from "@/stores/encryption";
import { Button } from "./ui/button";

interface HandoutImageUploadProps {
  questionId: Id<"questions">;
  imageId: string | null | undefined;
  onUpload: (imageId: string) => void;
  onRemove: () => void;
}

export function HandoutImageUpload({
  questionId,
  imageId,
  onUpload,
  onRemove,
}: HandoutImageUploadProps) {
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const generateUploadUrl = useConvexMutation(api.images.generateUploadUrl);
  const createImage = useConvexMutation(api.images.create);
  const removeImage = useConvexMutation(api.images.remove);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!masterKey) {
        toast.error("Ключ шифрования не найден");
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Выберите файл изображения");
        return;
      }

      setIsUploading(true);

      try {
        // Generate upload URL
        const uploadUrl = await generateUploadUrl();

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Encrypt the image
        const { encryptedBlob, iv } = await encryptImageBinary(masterKey, arrayBuffer);

        // Upload encrypted blob
        const response = await fetch(uploadUrl, {
          method: "POST",
          body: encryptedBlob,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } = await response.json();

        // Create image record
        const newImageId = await createImage({
          questionId,
          storageId,
          iv,
          contentType: file.type,
          filename: `handout_${Date.now()}`,
        });

        onUpload(newImageId);
        toast.success("Изображение загружено");
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setIsUploading(false);
      }
    },
    [masterKey, generateUploadUrl, createImage, questionId, onUpload],
  );

  const handleRemove = useCallback(async () => {
    if (!imageId) return;

    try {
      await removeImage({ id: imageId as Id<"images"> });
      onRemove();
      toast.success("Изображение удалено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    }
  }, [imageId, removeImage, onRemove]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleUpload],
  );

  if (imageId) {
    return <ImagePreview imageId={imageId as Id<"images">} onRemove={handleRemove} />;
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Загрузка...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Перетащите изображение или{" "}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-primary hover:underline"
            >
              выберите файл
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

interface ImagePreviewProps {
  imageId: Id<"images">;
  onRemove: () => void;
}

function ImagePreview({ imageId, onRemove }: ImagePreviewProps) {
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const image = useConvexQuery(api.images.get, { id: imageId });

  const [decryptedSrc, setDecryptedSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function decryptImage() {
      if (!masterKey || !image?.url) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(image.url);
        const encryptedData = await response.arrayBuffer();
        const decryptedData = await decryptImageData(masterKey, encryptedData, image.iv);
        const blob = new Blob([decryptedData], { type: image.contentType });
        const url = URL.createObjectURL(blob);

        if (!cancelled) {
          urlRef.current = url;
          setDecryptedSrc(url);
          setLoading(false);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch {
        if (!cancelled) {
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
  }, [masterKey, image]);

  if (image === undefined || loading) {
    return (
      <div
        className="relative rounded-lg overflow-hidden bg-muted animate-pulse"
        style={{ minHeight: 120 }}
      />
    );
  }

  if (!image || !decryptedSrc) {
    return (
      <div className="relative rounded-lg border p-4 text-sm text-muted-foreground">
        Изображение не найдено
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          className="absolute top-2 right-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border">
      {/* biome-ignore lint/performance/noImgElement: Using decrypted blob URL */}
      <img
        src={decryptedSrc}
        alt="Раздатка"
        className="max-w-full h-auto max-h-64 object-contain mx-auto"
      />
      <Button
        type="button"
        variant="destructive"
        size="icon-xs"
        onClick={onRemove}
        className="absolute top-2 right-2"
        title="Удалить изображение"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
