"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  HelpCircle,
  Loader2,
  Plus,
  Trello,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { usePackageImport } from "@/hooks/use-package-import";
import { useTrello } from "@/hooks/use-trello";
import type { Question as ParsedQuestion, ParsedStructure } from "@/lib/parser";
import { type DocxImage, parseDocx } from "@/lib/parser/docx";
import { parseTxtFile } from "@/lib/parser/txt";
import { openTrelloAuth, testTrelloConnection } from "@/lib/trello/client";
import { getTrelloBoards, importTrelloBoard } from "@/lib/trello/import";

export default function NewPackagePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex package import
  const { importParsedPackage, createEmptyPackage, getConvexDeps } = usePackageImport();

  // Trello state (from Convex)
  const {
    isConnected: trelloConnected,
    isReady: trelloReady,
    getToken,
    saveToken,
    deleteToken,
  } = useTrello();

  const [showTrello, setShowTrello] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [listsAsTours, setListsAsTours] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [trelloToken, setTrelloToken] = useState<string | null>(null);

  // Fetch Trello boards when connected
  const { data: trelloBoards, isLoading: boardsLoading } = useQuery({
    queryKey: ["trello-boards", trelloToken],
    queryFn: () => (trelloToken ? getTrelloBoards(trelloToken) : Promise.resolve([])),
    enabled: trelloConnected && showTrello && !!trelloToken,
  });

  // Load decrypted token when Trello section is opened
  const handleShowTrello = async () => {
    setShowTrello(!showTrello);
    if (!showTrello && trelloConnected && !trelloToken) {
      const token = await getToken();
      setTrelloToken(token);
    }
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsProcessing(true);
      setError(null);

      try {
        let structure: ParsedStructure;
        let images: DocxImage[] = [];

        if (file.name.toLowerCase().endsWith(".txt")) {
          // Parse TXT file
          const content = await file.text();
          const txtQuestions = parseTxtFile(content);
          structure = txtQuestions.map((q) => [
            "Question",
            {
              question: q.question,
              answer: q.answer ?? undefined,
              zachet: q.zachet ?? undefined,
              nezachet: q.nezachet ?? undefined,
              comment: q.comment ?? undefined,
              source: q.source ?? undefined,
              author: q.author ?? undefined,
              handout: q.handout ?? undefined,
            } as ParsedQuestion,
          ]);
        } else {
          // Parse DOCX file
          const result = await parseDocx(file);
          structure = result.structure;
          images = result.images;
        }

        const title = file.name.replace(/\.(docx|txt)$/i, "");
        const packageId = await importParsedPackage(title, structure, images);
        return packageId;
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: (packageId) => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push(`/${packageId}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Ошибка при импорте файла");
    },
  });

  const createEmptyMutation = useMutation({
    mutationFn: async () => {
      const packageId = await createEmptyPackage("Новый пакет");
      return packageId;
    },
    onSuccess: (packageId) => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push(`/${packageId}/edit`);
    },
  });

  const trelloImportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoard || !trelloToken) throw new Error("Board not selected or not authorized");
      const deps = getConvexDeps();
      if (!deps) throw new Error("Encryption not ready");
      setImportStatus("Начинаем импорт...");
      const result = await importTrelloBoard(
        { token: trelloToken, boardId: selectedBoard, listsAsTours },
        deps,
        setImportStatus,
      );
      return result;
    },
    onSuccess: (result) => {
      setImportStatus(null);
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push(`/${result.packageId}`);
    },
    onError: (err) => {
      setImportStatus(null);
      setError(err instanceof Error ? err.message : "Ошибка импорта из Trello");
    },
  });

  const handleTrelloConnect = async () => {
    if (!trelloReady) {
      setError("Шифрование не готово");
      return;
    }
    try {
      const token = await openTrelloAuth();
      // Verify token works
      const result = await testTrelloConnection(token);
      if (result.ok) {
        // Save encrypted token to Convex
        await saveToken(token);
        setTrelloToken(token);
        queryClient.invalidateQueries({ queryKey: ["trello-boards"] });
      } else {
        setError(result.error || "Не удалось подключить Trello");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    }
  };

  const handleTrelloDisconnect = async () => {
    try {
      await deleteToken();
      setTrelloToken(null);
      setSelectedBoard(null);
      queryClient.removeQueries({ queryKey: ["trello-boards"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отключения");
    }
  };

  const handleFile = useCallback(
    (file: File) => {
      const isDocx =
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

      if (isDocx || isTxt) {
        importMutation.mutate(file);
      } else {
        setError("Пожалуйста, выберите файл DOCX или TXT");
      }
    },
    [importMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const supportedFile = files.find(
        (f) =>
          f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          f.type === "text/plain" ||
          f.name.toLowerCase().endsWith(".txt"),
      );

      if (supportedFile) {
        handleFile(supportedFile);
      } else {
        setError("Пожалуйста, выберите файл DOCX или TXT");
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
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/packages"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Все пакеты
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Новый пакет</h1>
        <p className="mt-2 text-muted-foreground">Импортируйте файл или создайте пакет с нуля</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
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
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50"
        } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      >
        {isProcessing ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <p className="text-lg font-display font-semibold">Обработка файла...</p>
              <p className="text-sm text-muted-foreground mt-1">Парсинг и шифрование данных</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-display font-semibold">Перетащите файл сюда</p>
              <p className="text-sm text-muted-foreground mt-1">
                Поддерживаются форматы DOCX и TXT
              </p>
            </div>
            <label className="inline-flex items-center gap-2 btn-primary rounded-lg px-5 py-2.5 text-sm cursor-pointer">
              <FileText className="h-4 w-4" />
              Выбрать файл
              <input
                type="file"
                accept=".docx,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}
      </section>

      {/* Format hint */}
      <details className="group rounded-xl border bg-card p-5">
        <summary className="flex items-center gap-3 cursor-pointer list-none">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <span className="font-medium">Поддерживаемые форматы</span>
            <p className="text-sm text-muted-foreground">DOCX, TXT с маркерами полей</p>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5 pt-5 border-t space-y-4 text-sm">
          <div>
            <p className="font-medium mb-2">DOCX (Microsoft Word)</p>
            <p className="text-muted-foreground">
              Парсер автоматически распознает структуру по маркерам:
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                ["Вопрос 1:", "номер вопроса"],
                ["Ответ:", "правильный ответ"],
                ["Зачёт:", "альтернативы"],
                ["Комментарий:", "пояснение"],
                ["Источник:", "источник"],
                ["Автор:", "автор вопроса"],
              ].map(([marker, desc]) => (
                <div key={marker} className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{marker}</code>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">TXT (простой текст)</p>
            <p className="text-muted-foreground">Такой же формат с маркерами полей.</p>
          </div>
        </div>
      </details>

      {/* Trello import */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <button
          type="button"
          onClick={handleShowTrello}
          className="flex items-center gap-4 w-full p-5 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-[#0079bf]/10 flex items-center justify-center">
            <Trello className="h-5 w-5 text-[#0079bf]" />
          </div>
          <div className="flex-1">
            <span className="font-medium">Импорт из Trello</span>
            <p className="text-sm text-muted-foreground">
              {trelloConnected ? "Подключено" : "Импортируйте карточки как вопросы"}
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform ${showTrello ? "rotate-180" : ""}`}
          />
        </button>

        {showTrello && (
          <div className="px-5 pb-5 space-y-4 border-t">
            <div className="pt-4">
              {!trelloConnected ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                    Подключите Trello, чтобы импортировать карточки. Название карточки станет
                    текстом вопроса.
                  </p>
                  <button
                    type="button"
                    onClick={handleTrelloConnect}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0079bf] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#026aa7] transition-colors"
                  >
                    <Trello className="h-4 w-4" />
                    Подключить Trello
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-emerald-600">
                      <Check className="h-4 w-4" />
                      Trello подключен
                    </span>
                    <button
                      type="button"
                      onClick={handleTrelloDisconnect}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Отключить
                    </button>
                  </div>

                  <div>
                    <label htmlFor="trello-board" className="text-sm font-medium">
                      Выберите доску
                    </label>
                    {boardsLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Загрузка досок...
                      </div>
                    ) : (
                      <select
                        id="trello-board"
                        value={selectedBoard || ""}
                        onChange={(e) => setSelectedBoard(e.target.value || null)}
                        className="mt-2 w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                      >
                        <option value="">-- Выберите доску --</option>
                        {trelloBoards?.map((board) => (
                          <option key={board.id} value={board.id}>
                            {board.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={listsAsTours}
                      onChange={(e) => setListsAsTours(e.target.checked)}
                      className="rounded border-input w-4 h-4"
                    />
                    <span>Списки как туры</span>
                  </label>

                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground transition-colors">
                      Формат карточек Trello
                    </summary>
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-1">
                      <p>
                        <strong className="text-foreground">Название:</strong> текст вопроса
                      </p>
                      <p>
                        <strong className="text-foreground">Описание:</strong>
                      </p>
                      <pre className="text-[11px] bg-background p-2 rounded mt-1 font-mono">
                        {`Ответ: правильный ответ
Зачёт: альтернативные ответы
Комментарий: пояснение`}
                      </pre>
                    </div>
                  </details>

                  {importStatus && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {importStatus}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => trelloImportMutation.mutate()}
                    disabled={!selectedBoard || trelloImportMutation.isPending}
                    className="w-full btn-primary rounded-lg px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {trelloImportMutation.isPending ? "Импорт..." : "Импортировать"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create empty */}
      <div className="relative">
        <div className="divider-ornament text-sm">или</div>
      </div>

      <div className="text-center pb-8">
        <button
          type="button"
          onClick={() => createEmptyMutation.mutate()}
          disabled={createEmptyMutation.isPending}
          className="inline-flex items-center gap-2 btn-outline rounded-lg px-6 py-3 text-sm disabled:opacity-50"
        >
          {createEmptyMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Создание...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Создать пустой пакет
            </>
          )}
        </button>
      </div>
    </div>
  );
}
