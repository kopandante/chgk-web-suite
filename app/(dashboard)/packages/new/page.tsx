"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createPackage, importParsedPackage } from "@/lib/db/client";
import { parseDocx } from "@/lib/parser/docx";

export default function NewPackagePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { structure } = await parseDocx(file);
        const title = file.name.replace(/\.docx$/i, "");
        const packageId = await importParsedPackage(title, structure);
        return packageId;
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: (packageId) => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push(`/packages/${packageId}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Ошибка при импорте файла");
    },
  });

  const createEmptyMutation = useMutation({
    mutationFn: async () => {
      const pkg = await createPackage({ title: "Новый пакет" });
      return pkg.id;
    },
    onSuccess: (packageId) => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push(`/packages/${packageId}/edit`);
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        importMutation.mutate(file);
      } else {
        setError("Пожалуйста, выберите файл DOCX");
      }
    },
    [importMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const docxFile = files.find(
        (f) => f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      if (docxFile) {
        handleFile(docxFile);
      } else {
        setError("Пожалуйста, выберите файл DOCX");
      }
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Новый пакет</h1>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Drop zone */}
      <section
        aria-label="Зона для загрузки файла"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-muted"
        } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            <p className="text-lg font-medium">Обработка файла...</p>
          </>
        ) : (
          <>
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Перетащите DOCX файл сюда</p>
            <p className="text-sm text-muted-foreground mt-1">или выберите файл вручную</p>
            <label className="mt-4 inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium cursor-pointer hover:bg-secondary/80">
              <FileText className="h-4 w-4" />
              Выбрать файл
              <input type="file" accept=".docx" className="hidden" onChange={handleFileSelect} />
            </label>
          </>
        )}
      </section>

      {/* Or create empty */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">или</p>
        <button
          type="button"
          onClick={() => createEmptyMutation.mutate()}
          disabled={createEmptyMutation.isPending}
          className="mt-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          {createEmptyMutation.isPending ? "Создание..." : "Создать пустой пакет"}
        </button>
      </div>
    </div>
  );
}
