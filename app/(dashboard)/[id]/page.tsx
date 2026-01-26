"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation as useConvexMutation } from "convex/react";
import { Edit, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FormatAnswerField, FormatField, FormatSource, FormatText } from "@/components/format-text";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePackageSync } from "@/hooks/use-package-sync";
import { preparePackageCreate, type Question } from "@/lib/db/encrypted-client";
import { useEncryptionStore } from "@/stores/encryption";
import { usePackageStore } from "@/stores/package";

function QuestionCard({
  question,
  index,
  packageId,
}: {
  question: Question;
  index: number;
  packageId: Id<"packages">;
}) {
  const typeLabel =
    question.type === "duplet" ? "Дуплет" : question.type === "blitz" ? "Блиц" : null;

  // Handle source as string or array
  const sourceStr = Array.isArray(question.source) ? question.source.join("\n") : question.source;

  return (
    <div className="library-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Вопрос {question.number ?? index + 1}
          </span>
          {typeLabel && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
              {typeLabel}
            </span>
          )}
        </div>
        <Link
          href={`/${packageId}/edit/${question.id}`}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="Редактировать"
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
      {question.handout && (
        <div className="bg-secondary/50 rounded-md p-3 text-sm border-l-2 border-accent">
          <span className="text-muted-foreground">Раздатка: </span>
          <FormatText text={question.handout} questionId={question.id} />
        </div>
      )}
      <div className="whitespace-pre-wrap leading-relaxed">
        <FormatField value={question.question} questionId={question.id} />
      </div>
      {question.answer && (
        <div className="pt-3 border-t text-sm">
          <span className="text-muted-foreground">Ответ: </span>
          <span className="font-medium">
            <FormatAnswerField value={question.answer} questionId={question.id} />
          </span>
        </div>
      )}
      {question.zachet && (
        <div className="text-sm text-muted-foreground">
          <span>Зачет: </span>
          <FormatText text={question.zachet} questionId={question.id} />
        </div>
      )}
      {sourceStr && (
        <div className="text-sm text-muted-foreground">
          <span>Источник: </span>
          <FormatSource source={sourceStr} questionId={question.id} />
        </div>
      )}
      {question.comment && (
        <div className="text-sm text-muted-foreground">
          <span>Комментарий: </span>
          <FormatText text={question.comment} questionId={question.id} />
        </div>
      )}
      {question.author && (
        <div className="text-sm text-muted-foreground">
          <span>Автор: </span>
          <FormatText text={question.author} questionId={question.id} />
        </div>
      )}
    </div>
  );
}

function VirtualizedQuestionList({
  questions,
  packageId,
}: {
  questions: Question[];
  packageId: Id<"packages">;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: questions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {items.map((virtualItem) => {
          const question = questions[virtualItem.index];
          return (
            <div
              key={question.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full pb-3"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <QuestionCard question={question} index={virtualItem.index} packageId={packageId} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PackagePage() {
  const params = useParams();
  const packageId = params.id as Id<"packages">;
  const masterKey = useEncryptionStore((state) => state.masterKey);

  // Sync package data from Convex to store
  const { isLoading, notFound } = usePackageSync(packageId);

  // Read data from store
  const { pkg, tours, questions } = usePackageStore();

  const [selectedTourId, setSelectedTourId] = useState<Id<"tours"> | null>(null);

  // Metadata dialog state
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [metadataTitle, setMetadataTitle] = useState("");
  const [metadataEditor, setMetadataEditor] = useState("");
  const [metadataDate, setMetadataDate] = useState("");
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const updatePackageMutation = useConvexMutation(api.packages.update);

  const filteredQuestions = selectedTourId
    ? questions.filter((q) => q.tour_id === selectedTourId)
    : questions;

  const openMetadataDialog = () => {
    if (pkg) {
      setMetadataTitle(pkg.title);
      setMetadataEditor(pkg.editor || "");
      setMetadataDate(pkg.date || "");
      setMetadataError(null);
      setIsMetadataOpen(true);
    }
  };

  const handleSaveMetadata = async () => {
    if (!metadataTitle.trim()) {
      setMetadataError("Название обязательно");
      return;
    }

    if (!masterKey) return;

    setIsSavingMetadata(true);
    setMetadataError(null);

    try {
      const packageData = await preparePackageCreate(masterKey, {
        title: metadataTitle,
        editor: metadataEditor || undefined,
        date: metadataDate || undefined,
      });

      await updatePackageMutation({
        id: packageId,
        encryptedData: packageData.encryptedData,
        iv: packageData.iv,
      });

      setIsMetadataOpen(false);
      toast.success("Метаданные сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="mt-3 text-sm">Загрузка...</p>
      </div>
    );
  }

  if (notFound || !pkg) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-lg font-semibold">Пакет не найден</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Возможно, он был удален или у вас нет доступа.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{pkg.title}</h1>
          <button
            type="button"
            onClick={openMetadataDialog}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Редактировать метаданные"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        {pkg.editor && <p className="mt-1 text-sm text-muted-foreground">{pkg.editor}</p>}
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {pkg.question_count}{" "}
          {pkg.question_count === 1 ? "вопрос" : pkg.question_count < 5 ? "вопроса" : "вопросов"}
          {pkg.tour_count > 0 &&
            ` / ${pkg.tour_count} ${pkg.tour_count === 1 ? "тур" : pkg.tour_count < 5 ? "тура" : "туров"}`}
        </p>
      </div>

      {/* Metadata Dialog */}
      <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Метаданные пакета</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">
                Название <span className="text-destructive">*</span>
              </span>
              <input
                type="text"
                value={metadataTitle}
                onChange={(e) => {
                  setMetadataTitle(e.target.value);
                  setMetadataError(null);
                }}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                  metadataError ? "border-destructive" : ""
                }`}
              />
              {metadataError && <p className="mt-1 text-xs text-destructive">{metadataError}</p>}
            </label>
            <label className="block">
              <span className="text-sm font-medium">Редактор</span>
              <input
                type="text"
                value={metadataEditor}
                onChange={(e) => setMetadataEditor(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Дата</span>
              <input
                type="text"
                value={metadataDate}
                onChange={(e) => setMetadataDate(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="например: 2024-01-01"
              />
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsMetadataOpen(false)}
              className="btn-outline px-4 py-2 text-sm"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSaveMetadata}
              disabled={isSavingMetadata}
              className="btn-primary px-4 py-2 text-sm"
            >
              {isSavingMetadata ? "Сохранение..." : "Сохранить"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tours filter */}
      {tours.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-5">
          <button
            type="button"
            onClick={() => setSelectedTourId(null)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedTourId === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            Все
          </button>
          {tours.map((tour, index) => (
            <button
              type="button"
              key={tour.id}
              onClick={() => setSelectedTourId(tour.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedTourId === tour.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {tour.title || `Тур ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Questions */}
      {filteredQuestions.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0 mt-5">
          <div className="text-xs text-muted-foreground mb-3">
            {filteredQuestions.length} из {questions.length} вопросов
          </div>
          <VirtualizedQuestionList
            key={selectedTourId ?? "all"}
            questions={filteredQuestions}
            packageId={packageId}
          />
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground mt-5">
          <p className="text-sm">Нет вопросов</p>
          <Link
            href={`/${packageId}/edit`}
            className="mt-3 inline-flex items-center gap-1.5 btn-outline px-3 py-1.5 text-sm"
          >
            <Edit className="h-3.5 w-3.5" />
            Добавить
          </Link>
        </div>
      )}
    </div>
  );
}
