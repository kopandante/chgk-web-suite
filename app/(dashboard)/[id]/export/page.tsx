"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FileDown, FileText, Loader2, Presentation, Send } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  getImagesByPackage,
  getPackage,
  getQuestionsByPackage,
  getToursByPackage,
} from "@/lib/db/client";
import { type DocxExportOptions, downloadBlob, exportToDocx } from "@/lib/export/docx";
import { exportToPptx, type PptxExportOptions } from "@/lib/export/pptx";
import type { ParsedStructure } from "@/lib/parser";
import { compose4s } from "@/lib/parser/docx";

type ExportFormat = "docx" | "pptx" | "telegram" | "4s";

export default function ExportPackagePage() {
  const params = useParams();
  const packageId = params.id as string;
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [docxOptions, setDocxOptions] = useState<DocxExportOptions>({
    spoilerMode: "none",
    includeAnswers: true,
    includeZachet: true,
    includeComment: true,
    includeSource: true,
    includeAuthor: true,
    includeHandout: true,
  });
  const [pptxOptions, setPptxOptions] = useState<PptxExportOptions>({
    showQuestionNumber: true,
    separateAnswerSlides: true,
    includeImages: true,
  });

  const { data: pkg } = useQuery({
    queryKey: ["package", packageId],
    queryFn: () => getPackage(packageId),
  });

  const { data: questions } = useQuery({
    queryKey: ["questions", packageId],
    queryFn: () => getQuestionsByPackage(packageId),
    enabled: !!pkg,
  });

  const { data: tours } = useQuery({
    queryKey: ["tours", packageId],
    queryFn: () => getToursByPackage(packageId),
    enabled: !!pkg,
  });

  const { data: images } = useQuery({
    queryKey: ["images", packageId],
    queryFn: () => getImagesByPackage(packageId),
    enabled: !!pkg,
  });

  const exportDocxMutation = useMutation({
    mutationFn: async () => {
      if (!pkg || !questions || !tours || !images) {
        throw new Error("Data not loaded");
      }
      const blob = await exportToDocx(pkg, questions, tours, images, docxOptions);
      const filename = `${pkg.title.replace(/[^\w\s-]/g, "")}.docx`;
      downloadBlob(blob, filename);
    },
    onSuccess: () => {
      toast.success("Файл DOCX успешно создан");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Ошибка экспорта");
    },
  });

  const export4sMutation = useMutation({
    mutationFn: async () => {
      if (!pkg || !questions || !tours) {
        throw new Error("Data not loaded");
      }

      // Convert questions back to structure format for compose4s
      const structure: ParsedStructure = [];

      if (pkg.editor) {
        structure.push(["editor", pkg.editor]);
      }
      if (pkg.date) {
        structure.push(["date", pkg.date]);
      }

      // Group by tours
      const tourMap = new Map<string | null, typeof questions>();
      for (const q of questions) {
        const key = q.tour_id;
        if (!tourMap.has(key)) {
          tourMap.set(key, []);
        }
        tourMap.get(key)!.push(q);
      }

      for (const tour of tours.length > 0 ? tours : [null]) {
        const tourId = tour?.id ?? null;
        const tourQuestions = tourMap.get(tourId) || [];

        if (tour) {
          structure.push(["tour", tour.title || ""]);
        }

        for (const q of tourQuestions) {
          structure.push([
            "Question",
            {
              number: q.number ?? undefined,
              question: q.question,
              answer: q.answer ?? undefined,
              zachet: q.zachet ?? undefined,
              nezachet: q.nezachet ?? undefined,
              comment: q.comment ?? undefined,
              source: q.source ?? undefined,
              author: q.author ?? undefined,
              handout: q.handout ?? undefined,
            },
          ]);
        }
      }

      const content = compose4s(structure);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const filename = `${pkg.title.replace(/[^\w\s-]/g, "")}.4s`;
      downloadBlob(blob, filename);
    },
    onSuccess: () => {
      toast.success("Файл .4s успешно создан");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Ошибка экспорта");
    },
  });

  const exportPptxMutation = useMutation({
    mutationFn: async () => {
      if (!pkg || !questions || !tours || !images) {
        throw new Error("Data not loaded");
      }
      const blob = await exportToPptx(pkg, questions, tours, images, pptxOptions);
      const filename = `${pkg.title.replace(/[^\w\s-]/g, "")}.pptx`;
      downloadBlob(blob, filename);
    },
    onSuccess: () => {
      toast.success("Файл PPTX успешно создан");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Ошибка экспорта");
    },
  });

  const exportOptions = [
    {
      id: "docx" as const,
      name: "DOCX",
      description: "Документ Word",
      icon: FileText,
      available: true,
    },
    {
      id: "pptx" as const,
      name: "PPTX",
      description: "Презентация PowerPoint",
      icon: Presentation,
      available: true,
    },
    {
      id: "telegram" as const,
      name: "Telegram",
      description: "Формат для Telegram",
      icon: Send,
      available: false,
    },
    {
      id: "4s" as const,
      name: ".4s",
      description: "Формат SI Game",
      icon: FileDown,
      available: true,
    },
  ];

  const handleExport = (format: ExportFormat) => {
    if (format === "docx") {
      setSelectedFormat("docx");
    } else if (format === "pptx") {
      setSelectedFormat("pptx");
    } else if (format === "4s") {
      export4sMutation.mutate();
    } else {
      toast.info("Этот формат пока не реализован");
    }
  };

  const isExporting =
    exportDocxMutation.isPending || export4sMutation.isPending || exportPptxMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Экспорт пакета</h1>

      {selectedFormat === "pptx" ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedFormat(null)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Назад к выбору формата
          </button>

          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Настройки PPTX</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium">Опции</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { key: "showQuestionNumber", label: "Показывать номера вопросов" },
                  { key: "separateAnswerSlides", label: "Отдельные слайды для ответов" },
                  { key: "includeImages", label: "Включить изображения" },
                ].map((option) => (
                  <label key={option.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={pptxOptions[option.key as keyof PptxExportOptions] as boolean}
                      onChange={(e) =>
                        setPptxOptions((prev) => ({
                          ...prev,
                          [option.key]: e.target.checked,
                        }))
                      }
                      className="rounded border-input"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => exportPptxMutation.mutate()}
              disabled={exportPptxMutation.isPending || !pkg}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {exportPptxMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Экспорт...
                </span>
              ) : (
                "Экспортировать в PPTX"
              )}
            </button>
          </div>
        </div>
      ) : selectedFormat === "docx" ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedFormat(null)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Назад к выбору формата
          </button>

          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Настройки DOCX</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Режим спойлеров</label>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {[
                    { value: "none", label: "Без спойлеров" },
                    { value: "whiten", label: "Белый текст" },
                    { value: "pagebreak", label: "На новой странице" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setDocxOptions((prev) => ({
                          ...prev,
                          spoilerMode: option.value as DocxExportOptions["spoilerMode"],
                        }))
                      }
                      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                        docxOptions.spoilerMode === option.value
                          ? "bg-primary text-primary-foreground"
                          : "border hover:bg-accent"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Включить в экспорт</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "includeAnswers", label: "Ответы" },
                    { key: "includeZachet", label: "Зачет" },
                    { key: "includeComment", label: "Комментарии" },
                    { key: "includeSource", label: "Источники" },
                    { key: "includeAuthor", label: "Авторы" },
                    { key: "includeHandout", label: "Раздатки" },
                  ].map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={docxOptions[option.key as keyof DocxExportOptions] as boolean}
                        onChange={(e) =>
                          setDocxOptions((prev) => ({
                            ...prev,
                            [option.key]: e.target.checked,
                          }))
                        }
                        className="rounded border-input"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => exportDocxMutation.mutate()}
              disabled={exportDocxMutation.isPending || !pkg}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {exportDocxMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Экспорт...
                </span>
              ) : (
                "Экспортировать в DOCX"
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exportOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => handleExport(option.id)}
              disabled={!option.available || isExporting}
              className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-colors ${
                option.available ? "hover:border-primary" : "opacity-50 cursor-not-allowed"
              }`}
            >
              {isExporting && option.id === "4s" && export4sMutation.isPending ? (
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              ) : (
                <option.icon className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <div className="font-medium">{option.name}</div>
                <div className="text-sm text-muted-foreground">
                  {option.description}
                  {!option.available && " (скоро)"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
