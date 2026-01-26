"use client";

import { useMutation } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import {
  Braces,
  Check,
  Database,
  FileDown,
  FileText,
  Loader2,
  MessageSquare,
  Presentation,
  Send,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTelegramChannels } from "@/hooks/use-telegram-channel";
import {
  decryptPackage,
  decryptQuestions,
  decryptTours,
  type Image,
  loadImagesForExport,
  mapImages,
  type Package,
  type Question,
  type Tour,
} from "@/lib/db/encrypted-client";
import { downloadChgkDbFile, exportToChgkDb } from "@/lib/export/chgk-db";
import { type DocxExportOptions, downloadBlob, exportToDocx } from "@/lib/export/docx";
import { downloadOpenQuizFile } from "@/lib/export/openquiz";
import { exportToPptx, type PptxExportOptions } from "@/lib/export/pptx";
import { downloadRedditFile, exportToReddit } from "@/lib/export/reddit";
import { exportToTelegram, type TelegramExportOptions } from "@/lib/export/telegram";
import type { ParsedStructure } from "@/lib/parser";
import { compose4s } from "@/lib/parser/docx";
import { useEncryptionStore } from "@/stores/encryption";

type ExportFormat = "docx" | "pptx" | "telegram" | "4s" | "chgk-db" | "openquiz" | "reddit";

export default function ExportPackagePage() {
  const params = useParams();
  const packageId = params.id as Id<"packages">;
  const masterKey = useEncryptionStore((state) => state.masterKey);

  const [pkg, setPkg] = useState<Package | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [isDecrypting, setIsDecrypting] = useState(true);

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
    useSpoilers: true,
    includeZachet: true,
    includeComment: true,
    includeSource: true,
    includeAuthor: true,
    includeHandout: true,
    postDelay: 3000,
  });
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [telegramProgress, setTelegramProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Convex queries
  const encryptedPkg = useConvexQuery(api.packages.get, { id: packageId });
  const encryptedQuestions = useConvexQuery(api.questions.listByPackage, { packageId });
  const encryptedTours = useConvexQuery(api.tours.listByPackage, { packageId });
  const encryptedImages = useConvexQuery(api.images.listByPackage, { packageId });

  // Decrypt package
  useEffect(() => {
    if (!encryptedPkg || !masterKey) {
      setPkg(null);
      return;
    }

    decryptPackage(masterKey, encryptedPkg)
      .then(setPkg)
      .catch((err) => {
        console.error("Failed to decrypt package:", err);
        setPkg(null);
      });
  }, [encryptedPkg, masterKey]);

  // Decrypt questions
  useEffect(() => {
    if (!encryptedQuestions || !masterKey) {
      setQuestions([]);
      return;
    }

    decryptQuestions(masterKey, encryptedQuestions)
      .then((decrypted) => {
        // Sort by order_num
        const sorted = [...decrypted].sort((a, b) => a.order_num - b.order_num);
        setQuestions(sorted);
      })
      .catch((err) => {
        console.error("Failed to decrypt questions:", err);
        setQuestions([]);
      });
  }, [encryptedQuestions, masterKey]);

  // Decrypt tours
  useEffect(() => {
    if (!encryptedTours || !masterKey) {
      setTours([]);
      setIsDecrypting(false);
      return;
    }

    decryptTours(masterKey, encryptedTours)
      .then((decrypted) => {
        setTours(decrypted);
        setIsDecrypting(false);
      })
      .catch((err) => {
        console.error("Failed to decrypt tours:", err);
        setTours([]);
        setIsDecrypting(false);
      });
  }, [encryptedTours, masterKey]);

  // Map images
  useEffect(() => {
    if (!encryptedImages) {
      setImages([]);
      return;
    }
    setImages(mapImages(encryptedImages));
  }, [encryptedImages]);

  // Convex real-time channels state
  const { channels } = useTelegramChannels();

  // Selected channel (with fallback to first)
  const selectedChannel = channels.find((c) => c.channelId === selectedChannelId) ?? channels[0];

  // Warning when leaving during Telegram export
  useEffect(() => {
    if (!telegramProgress) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return "Отправка в Telegram будет прервана. Вы уверены?";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [telegramProgress]);

  const exportDocxMutation = useMutation({
    mutationFn: async () => {
      if (!pkg || !questions || !tours || !masterKey) {
        throw new Error("Data not loaded");
      }
      // Load and decrypt images for export
      const loadedImages = await loadImagesForExport(masterKey, images);
      const blob = await exportToDocx(pkg, questions, tours, loadedImages, docxOptions);
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
      if (!pkg || !questions || !tours || !masterKey) {
        throw new Error("Data not loaded");
      }
      // Load and decrypt images for export
      const loadedImages = await loadImagesForExport(masterKey, images);
      const blob = await exportToPptx(pkg, questions, tours, loadedImages, pptxOptions);
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

  const exportTelegramMutation = useMutation({
    mutationFn: async () => {
      if (!questions) {
        throw new Error("Questions not loaded");
      }
      if (!selectedChannel?.channelId) {
        throw new Error("Channel not selected");
      }
      setTelegramProgress({ current: 0, total: questions.length });
      const result = await exportToTelegram(
        questions,
        {
          channelId: selectedChannel.channelId,
          channelTitle: selectedChannel.channelTitle || "",
          ...telegramOptions,
        } as TelegramExportOptions,
        (current, total) => setTelegramProgress({ current, total }),
      );
      setTelegramProgress(null);
      return result;
    },
    onSuccess: (result) => {
      if (result.stopped) {
        toast.error(`Остановлено после ${result.success} вопросов. ${result.errors[0]}`);
      } else {
        toast.success(`Все ${result.success} вопросов отправлены`);
      }
    },
    onError: (err) => {
      setTelegramProgress(null);
      toast.error(err instanceof Error ? err.message : "Ошибка экспорта");
    },
  });

  const exportChgkDbMutation = useMutation({
    mutationFn: async () => {
      if (!pkg || !questions || !tours) {
        throw new Error("Data not loaded");
      }
      const content = exportToChgkDb(pkg, questions, tours);
      const filename = `${pkg.title.replace(/[^\w\s-]/g, "")}.txt`;
      downloadChgkDbFile(content, filename);
    },
    onSuccess: () => {
      toast.success("Файл для db.chgk.info создан");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Ошибка экспорта");
    },
  });

  const exportOpenQuizMutation = useMutation({
    mutationFn: async () => {
      if (!pkg || !questions || !tours) {
        throw new Error("Data not loaded");
      }
      downloadOpenQuizFile(pkg, questions, tours);
    },
    onSuccess: () => {
      toast.success("Файл OpenQuiz JSON создан");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Ошибка экспорта");
    },
  });

  const exportRedditMutation = useMutation({
    mutationFn: async () => {
      if (!pkg || !questions || !tours) {
        throw new Error("Data not loaded");
      }
      const content = exportToReddit(pkg, questions, tours);
      const filename = `${pkg.title.replace(/[^\w\s-]/g, "")}.md`;
      downloadRedditFile(content, filename);
    },
    onSuccess: () => {
      toast.success("Файл Reddit Markdown создан");
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
    {
      id: "chgk-db" as const,
      name: "db.chgk.info",
      description: "База вопросов ЧГК",
      icon: Database,
      available: true,
    },
    {
      id: "openquiz" as const,
      name: "OpenQuiz",
      description: "JSON для OpenQuiz",
      icon: Braces,
      available: true,
    },
    {
      id: "reddit" as const,
      name: "Reddit",
      description: "Markdown для Reddit",
      icon: MessageSquare,
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
    } else if (format === "chgk-db") {
      exportChgkDbMutation.mutate();
    } else if (format === "openquiz") {
      exportOpenQuizMutation.mutate();
    } else if (format === "reddit") {
      exportRedditMutation.mutate();
    } else {
      toast.info("Этот формат пока не реализован");
    }
  };

  const isExporting =
    exportDocxMutation.isPending ||
    export4sMutation.isPending ||
    exportPptxMutation.isPending ||
    exportTelegramMutation.isPending ||
    exportChgkDbMutation.isPending ||
    exportOpenQuizMutation.isPending ||
    exportRedditMutation.isPending;

  // Loading state
  if (encryptedPkg === undefined || isDecrypting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="mt-4 font-medium">Загрузка пакета...</p>
        <p className="text-sm">Расшифровка данных</p>
      </div>
    );
  }

  // Not found
  if (!pkg) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h1 className="text-2xl font-display font-bold">Пакет не найден</h1>
        <Link
          href="/packages"
          className="mt-6 inline-flex items-center gap-2 btn-primary rounded-lg px-5 py-2.5 text-sm"
        >
          Вернуться к пакетам
        </Link>
      </div>
    );
  }

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
              <span className="text-sm font-medium">Опции</span>
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

            <div className="pt-2 border-t">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pptxOptions.randomize ?? false}
                  onChange={(e) =>
                    setPptxOptions((prev) => ({
                      ...prev,
                      randomize: e.target.checked,
                    }))
                  }
                  className="rounded border-input"
                />
                Перемешать вопросы
              </label>
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
              {/* Channel selection */}
              <div>
                <span className="text-sm font-medium">Канал</span>

                {channels.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {channels.map((channel) => (
                      <button
                        key={channel.channelId}
                        type="button"
                        onClick={() => setSelectedChannelId(channel.channelId)}
                        className={`w-full flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          selectedChannel?.channelId === channel.channelId
                            ? "border-primary bg-primary/5"
                            : "hover:bg-accent"
                        }`}
                      >
                        {selectedChannel?.channelId === channel.channelId && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        <span>{channel.channelTitle || channel.channelId}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-md border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">Нет привязанных каналов</p>
                    <Link
                      href="/settings"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Settings className="h-4 w-4" />
                      Привязать в настройках
                    </Link>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="post-delay" className="text-sm font-medium">
                  Задержка между постами
                </label>
                <select
                  id="post-delay"
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
                <span className="text-sm font-medium">Опции</span>
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
              onClick={() => exportTelegramMutation.mutate()}
              disabled={
                exportTelegramMutation.isPending ||
                !selectedChannel?.channelId ||
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
                <span className="text-sm font-medium">Режим спойлеров</span>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {[
                    { value: "none", label: "Без спойлеров" },
                    { value: "whiten", label: "Белый текст" },
                    { value: "pagebreak", label: "На новой странице" },
                    { value: "dots", label: "Точки вместо ответа" },
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
                <span className="text-sm font-medium">Включить в экспорт</span>
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

              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={docxOptions.randomize ?? false}
                    onChange={(e) =>
                      setDocxOptions((prev) => ({
                        ...prev,
                        randomize: e.target.checked,
                      }))
                    }
                    className="rounded border-input"
                  />
                  Перемешать вопросы
                </label>
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
