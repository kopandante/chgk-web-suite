"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Trello, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPackage, importParsedPackage } from "@/lib/db/client";
import { parseDocx } from "@/lib/parser/docx";
import {
  clearTrelloToken,
  getTrelloToken,
  openTrelloAuth,
  testTrelloConnection,
} from "@/lib/trello/client";
import { getTrelloBoards, importTrelloBoard } from "@/lib/trello/import";

export default function NewPackagePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trello state
  const [showTrello, setShowTrello] = useState(false);
  const [trelloConnected, setTrelloConnected] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [listsAsTours, setListsAsTours] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Check Trello connection on mount
  useEffect(() => {
    const token = getTrelloToken();
    if (token) {
      testTrelloConnection().then((result) => {
        setTrelloConnected(result.ok);
      });
    }
  }, []);

  // Fetch Trello boards when connected
  const { data: trelloBoards, isLoading: boardsLoading } = useQuery({
    queryKey: ["trello-boards"],
    queryFn: getTrelloBoards,
    enabled: trelloConnected && showTrello,
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsProcessing(true);
      setError(null);

      try {
        const { structure, images } = await parseDocx(file);
        const title = file.name.replace(/\.docx$/i, "");
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
      if (!selectedBoard) throw new Error("Board not selected");
      setImportStatus("Начинаем импорт...");
      const result = await importTrelloBoard(
        { boardId: selectedBoard, listsAsTours },
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
    try {
      await openTrelloAuth();
      setTrelloConnected(true);
      queryClient.invalidateQueries({ queryKey: ["trello-boards"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    }
  };

  const handleTrelloDisconnect = () => {
    clearTrelloToken();
    setTrelloConnected(false);
    setSelectedBoard(null);
    queryClient.removeQueries({ queryKey: ["trello-boards"] });
  };

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

      {/* Trello import */}
      <div className="rounded-lg border p-4">
        <button
          type="button"
          onClick={() => setShowTrello(!showTrello)}
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
                  Подключите Trello, чтобы импортировать карточки как вопросы
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

                <label className="block">
                  <span className="text-sm font-medium">Выберите доску</span>
                  {boardsLoading ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Загрузка досок...
                    </div>
                  ) : (
                    <select
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
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={listsAsTours}
                    onChange={(e) => setListsAsTours(e.target.checked)}
                    className="rounded border-input"
                  />
                  Списки как туры
                </label>

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
