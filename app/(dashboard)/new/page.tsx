"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileText, HelpCircle, Loader2, Trello, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTrello } from "@/hooks/use-trello";
import { createPackage, importParsedPackage } from "@/lib/db/client";
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
      const pkg = await createPackage({ title: "Новый пакет" });
      return pkg.id;
    },
    onSuccess: (packageId) => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push(`/${packageId}/edit`);
    },
  });

  const trelloImportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoard || !trelloToken) throw new Error("Board not selected or not authorized");
      setImportStatus("Начинаем импорт...");
      const result = await importTrelloBoard(
        { token: trelloToken, boardId: selectedBoard, listsAsTours },
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
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Все пакеты
      </Link>

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
            <p className="text-lg font-medium">Перетащите DOCX или TXT файл сюда</p>
            <p className="text-sm text-muted-foreground mt-1">или выберите файл вручную</p>
            <label className="mt-4 inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium cursor-pointer hover:bg-secondary/80">
              <FileText className="h-4 w-4" />
              Выбрать файл
              <input
                type="file"
                accept=".docx,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </>
        )}
      </section>

      {/* Format hint */}
      <details className="rounded-lg border p-4 text-sm">
        <summary className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
          <span>Поддерживаемые форматы файлов</span>
        </summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">DOCX (Microsoft Word)</p>
            <p>Парсер автоматически распознает структуру вопросов по маркерам:</p>
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li>
                <code className="text-xs bg-muted px-1 rounded">Вопрос 1:</code> или{" "}
                <code className="text-xs bg-muted px-1 rounded">1.</code> — номер вопроса
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">Ответ:</code> — правильный ответ
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">Зачёт:</code> — альтернативные
                ответы
              </li>
              <li>
                <code className="text-xs bg-muted px-1 rounded">Комментарий:</code>,{" "}
                <code className="text-xs bg-muted px-1 rounded">Источник:</code>,{" "}
                <code className="text-xs bg-muted px-1 rounded">Автор:</code>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">TXT (простой текст)</p>
            <p>Такой же формат с маркерами полей.</p>
          </div>
        </div>
      </details>

      {/* Trello import */}
      <div className="rounded-lg border p-4">
        <button
          type="button"
          onClick={handleShowTrello}
          className="flex items-center gap-2 w-full text-left"
        >
          <Trello className="h-5 w-5 text-[#0079bf]" />
          <span className="font-medium">Импорт из Trello</span>
          <span className="ml-auto text-muted-foreground">{showTrello ? "−" : "+"}</span>
        </button>

        {showTrello && (
          <div className="mt-4 space-y-4">
            {!trelloConnected ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Подключите Trello, чтобы импортировать карточки как вопросы. Название карточки
                  станет текстом вопроса.
                </p>
                <button
                  type="button"
                  onClick={handleTrelloConnect}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0079bf] px-4 py-2 text-sm font-medium text-white hover:bg-[#026aa7]"
                >
                  <Trello className="h-4 w-4" />
                  Подключить Trello
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    Trello подключен
                  </span>
                  <button
                    type="button"
                    onClick={handleTrelloDisconnect}
                    className="text-muted-foreground hover:text-foreground"
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
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={listsAsTours}
                    onChange={(e) => setListsAsTours(e.target.checked)}
                    className="rounded border-input"
                  />
                  Списки как туры
                </label>

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    Формат карточек Trello
                  </summary>
                  <div className="mt-2 p-2 bg-muted/50 rounded space-y-1">
                    <p>
                      <strong>Название:</strong> текст вопроса
                    </p>
                    <p>
                      <strong>Описание:</strong>
                    </p>
                    <pre className="text-[11px] bg-background p-2 rounded mt-1">
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
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {trelloImportMutation.isPending ? "Импорт..." : "Импортировать"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
