"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, FileDown, FileText, Loader2, Presentation, Send, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getImagesByPackage,
  getPackage,
  getQuestionsByPackage,
  getToursByPackage,
} from "@/lib/db/client";
import { type DocxExportOptions, downloadBlob, exportToDocx } from "@/lib/export/docx";
import { exportToPptx, type PptxExportOptions } from "@/lib/export/pptx";
import {
  exportToTelegram,
  type TelegramExportOptions,
  testBotConnection,
} from "@/lib/export/telegram";
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
  const [telegramOptions, setTelegramOptions] = useState({
    channelId: "",
    useSpoilers: true,
    includeZachet: true,
    includeComment: true,
    includeSource: true,
    includeAuthor: true,
    includeHandout: true,
    postDelay: 3000,
  });
  const [telegramProgress, setTelegramProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [botStatus, setBotStatus] = useState<{
    tested: boolean;
    ok: boolean;
    name?: string;
    error?: string;
  }>({ tested: false, ok: false });

  // Load saved Telegram channel from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("telegram_channel");
    if (saved) {
      setTelegramOptions((prev) => ({ ...prev, channelId: saved }));
    }
  }, []);

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

  const testBotMutation = useMutation({
    mutationFn: async () => {
      const result = await testBotConnection();
      if (!result.ok) {
        throw new Error(result.error || "Connection failed");
      }
      return result;
    },
    onSuccess: (result) => {
      setBotStatus({ tested: true, ok: true, name: result.botName });
      // Save channel setting
      localStorage.setItem("telegram_channel", telegramOptions.channelId);
      toast.success(`Бот @${result.botName} подключен`);
    },
    onError: (err) => {
      setBotStatus({
        tested: true,
        ok: false,
        error: err instanceof Error ? err.message : "Error",
      });
      toast.error("Ошибка подключения к боту");
    },
  });

  const exportTelegramMutation = useMutation({
    mutationFn: async () => {
      if (!questions) {
        throw new Error("Questions not loaded");
      }
      setTelegramProgress({ current: 0, total: questions.length });
      const result = await exportToTelegram(
        questions,
        telegramOptions as TelegramExportOptions,
        (current, total) => setTelegramProgress({ current, total }),
      );
      setTelegramProgress(null);
      return result;
    },
    onSuccess: (result) => {
      if (result.failed > 0) {
        toast.warning(`Отправлено: ${result.success}, ошибок: ${result.failed}`);
      } else {
        toast.success(`Все ${result.success} вопросов отправлены`);
      }
    },
    onError: (err) => {
      setTelegramProgress(null);
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
      description: "Публикация в канал",
      icon: Send,
      available: true,
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
    } else if (format === "telegram") {
      setSelectedFormat("telegram");
    } else if (format === "4s") {
      export4sMutation.mutate();
    } else {
      toast.info("Этот формат пока не реализован");
    }
  };

  const isExporting =
    exportDocxMutation.isPending ||
    export4sMutation.isPending ||
    exportPptxMutation.isPending ||
    exportTelegramMutation.isPending;

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
      ) : selectedFormat === "telegram" ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedFormat(null)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Назад к выбору формата
          </button>

          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Настройки Telegram</h2>

            <div className="space-y-4">
              {/* Bot status */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => testBotMutation.mutate()}
                  disabled={testBotMutation.isPending}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  {testBotMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Проверка...
                    </span>
                  ) : botStatus.tested && botStatus.ok ? (
                    <span className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Бот подключен
                    </span>
                  ) : botStatus.tested && !botStatus.ok ? (
                    <span className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-600" />
                      Ошибка подключения
                    </span>
                  ) : (
                    "Проверить подключение"
                  )}
                </button>
                {botStatus.tested && botStatus.ok && botStatus.name && (
                  <span className="text-sm text-muted-foreground">@{botStatus.name}</span>
                )}
              </div>
              {botStatus.tested && !botStatus.ok && botStatus.error && (
                <p className="text-xs text-red-600">{botStatus.error}</p>
              )}

              <div>
                <label className="text-sm font-medium">ID канала</label>
                <input
                  type="text"
                  value={telegramOptions.channelId}
                  onChange={(e) =>
                    setTelegramOptions((prev) => ({
                      ...prev,
                      channelId: e.target.value,
                    }))
                  }
                  placeholder="@channel или -1001234567890"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Бот должен быть администратором канала
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Задержка между постами</label>
                <select
                  value={telegramOptions.postDelay}
                  onChange={(e) =>
                    setTelegramOptions((prev) => ({
                      ...prev,
                      postDelay: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value={1000}>1 секунда</option>
                  <option value={3000}>3 секунды</option>
                  <option value={5000}>5 секунд</option>
                  <option value={10000}>10 секунд</option>
                  <option value={30000}>30 секунд</option>
                  <option value={60000}>1 минута</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Опции</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "useSpoilers", label: "Спойлеры для ответов" },
                    { key: "includeZachet", label: "Зачет" },
                    { key: "includeComment", label: "Комментарии" },
                    { key: "includeSource", label: "Источники" },
                    { key: "includeAuthor", label: "Авторы" },
                    { key: "includeHandout", label: "Раздатки" },
                  ].map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={
                          telegramOptions[option.key as keyof typeof telegramOptions] as boolean
                        }
                        onChange={(e) =>
                          setTelegramOptions((prev) => ({
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

            {telegramProgress && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${(telegramProgress.current / telegramProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Отправлено {telegramProgress.current} из {telegramProgress.total}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                localStorage.setItem("telegram_channel", telegramOptions.channelId);
                exportTelegramMutation.mutate();
              }}
              disabled={
                exportTelegramMutation.isPending ||
                !telegramOptions.channelId ||
                !questions?.length
              }
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {exportTelegramMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Отправка...
                </span>
              ) : (
                `Отправить ${questions?.length || 0} вопросов в Telegram`
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
