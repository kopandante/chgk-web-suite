"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation as useConvexMutation } from "convex/react";
import { GripVertical, Loader2, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePackageSync } from "@/hooks/use-package-sync";
import {
  getFieldDisplayText,
  prepareQuestionCreate,
  type QuestionFieldValue,
  type Tour,
} from "@/lib/db/encrypted-client";
import { useEncryptionStore } from "@/stores/encryption";
import { useHeaderActionsStore } from "@/stores/header-actions";
import { usePackageStore } from "@/stores/package";

interface QuestionFormData {
  id: string;
  tourId: Id<"tours"> | null;
  number: number | null;
  question: QuestionFieldValue;
  answer: QuestionFieldValue | null;
  zachet: string | null;
  nezachet: string | null;
  comment: string | null;
  source: string | string[] | null;
  author: string | null;
  handout: string | null;
}

// Compact sortable question card
function SortableQuestionCard({
  question,
  index,
  onEdit,
  hasError,
}: {
  question: QuestionFormData;
  index: number;
  onEdit: () => void;
  hasError: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    data: { tourId: question.tourId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const questionText = getFieldDisplayText(question.question) || "Новый вопрос";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-background ${hasError ? "border-destructive" : ""}`}
    >
      <div className="flex gap-2 p-2">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none p-1 shrink-0 self-start"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 text-left hover:bg-muted/50 -my-1 py-1 px-1 rounded min-w-0"
        >
          <p className="text-xs text-muted-foreground line-clamp-2">
            <span className="font-medium text-foreground">#{question.number ?? index + 1}</span>{" "}
            {questionText}
          </p>
        </button>
      </div>
    </div>
  );
}

// Drag overlay for visual feedback
function QuestionDragOverlay({ question }: { question: QuestionFormData }) {
  const questionText = getFieldDisplayText(question.question);
  return (
    <div className="rounded-lg border bg-background shadow-lg p-2 w-64">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-xs">#{question.number ?? "?"}</span>
        <span className="text-xs text-muted-foreground truncate">
          {questionText.slice(0, 30) || "Новый вопрос"}
        </span>
      </div>
    </div>
  );
}

// Tour column component
function TourColumn({
  tour,
  index,
  questions,
  onEdit,
  onAdd,
  errors,
}: {
  tour: Tour | null;
  index: number;
  questions: QuestionFormData[];
  onEdit: (id: string) => void;
  onAdd: () => void;
  errors: Record<string, string>;
}) {
  const tourId = tour?.id ?? null;
  const containerId = tourId ?? "no-tour";

  const { setNodeRef, isOver } = useDroppable({
    id: containerId,
    data: { tourId },
  });

  return (
    <div
      className={`flex flex-col min-w-72 max-w-80 rounded-lg border ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">
          {tour?.title || `Тур ${index + 1}`}
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            ({questions.length})
          </span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="p-1 rounded hover:bg-muted"
          title="Добавить вопрос"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-32 overflow-auto">
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          {questions.map((q, idx) => (
            <SortableQuestionCard
              key={q.id}
              question={q}
              index={idx}
              onEdit={() => onEdit(q.id)}
              hasError={!!errors[q.id]}
            />
          ))}
        </SortableContext>
        {questions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Перетащите сюда вопросы
          </div>
        )}
      </div>
    </div>
  );
}

// "No tour" column for questions without tour
function NoTourColumn({
  questions,
  onEdit,
  onAdd,
  errors,
}: {
  questions: QuestionFormData[];
  onEdit: (id: string) => void;
  onAdd: () => void;
  errors: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "no-tour",
    data: { tourId: null },
  });

  return (
    <div
      className={`flex flex-col min-w-72 max-w-80 rounded-lg border ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">
          Без тура
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            ({questions.length})
          </span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="p-1 rounded hover:bg-muted"
          title="Добавить вопрос"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-32 overflow-auto">
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          {questions.map((q, idx) => (
            <SortableQuestionCard
              key={q.id}
              question={q}
              index={idx}
              onEdit={() => onEdit(q.id)}
              hasError={!!errors[q.id]}
            />
          ))}
        </SortableContext>
        {questions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Перетащите сюда вопросы
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditPackagePage() {
  const params = useParams();
  const packageId = params.id as Id<"packages">;
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const setHeaderActions = useHeaderActionsStore((state) => state.setActions);

  // Sync package data from Convex to store
  const { isLoading, notFound } = usePackageSync(packageId);

  // Read data from store
  const { pkg, tours, questions: storeQuestions } = usePackageStore();

  // Local state for drag-and-drop editing
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const router = useRouter();

  // Convex mutations
  const updateQuestionMutation = useConvexMutation(api.questions.update);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Initialize local form state from store
  useEffect(() => {
    if (pkg && storeQuestions.length > 0 && !initialized) {
      setQuestions(
        storeQuestions.map((q) => ({
          id: q.id,
          tourId: q.tour_id,
          number: q.number,
          question: q.question,
          answer: q.answer,
          zachet: q.zachet,
          nezachet: q.nezachet,
          comment: q.comment,
          source: q.source,
          author: q.author,
          handout: q.handout,
        })),
      );
      setInitialized(true);
    }
  }, [pkg, storeQuestions, initialized]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    for (const q of questions) {
      const questionText = getFieldDisplayText(q.question);
      if (!questionText.trim()) {
        newErrors[q.id] = "Текст вопроса обязателен";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !masterKey) return;

    setIsSaving(true);

    try {
      // Group questions by tour for order calculation
      const questionsByTour = new Map<string, QuestionFormData[]>();
      for (const q of questions) {
        const key = q.tourId ?? "no-tour";
        if (!questionsByTour.has(key)) {
          questionsByTour.set(key, []);
        }
        questionsByTour.get(key)!.push(q);
      }

      for (const q of questions) {
        const questionData = await prepareQuestionCreate(masterKey, {
          number: q.number ?? undefined,
          question: q.question,
          answer: q.answer ?? undefined,
          zachet: q.zachet ?? undefined,
          nezachet: q.nezachet ?? undefined,
          comment: q.comment ?? undefined,
          source: q.source ?? undefined,
          author: q.author ?? undefined,
          handout: q.handout ?? undefined,
        });

        const tourQuestions = questionsByTour.get(q.tourId ?? "no-tour") ?? [];
        const orderNum = tourQuestions.indexOf(q);

        await updateQuestionMutation({
          id: q.id as Id<"questions">,
          encryptedData: questionData.encryptedData,
          iv: questionData.iv,
          tourId: q.tourId ?? undefined,
          orderNum,
        });
      }

      setHasChanges(false);
      setInitialized(false);
      toast.success("Изменения сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const addQuestion = useCallback(() => {
    router.push(`/${packageId}/grid/new`);
  }, [packageId, router]);

  // Header actions
  useEffect(() => {
    setHeaderActions(
      <button
        type="button"
        onClick={addQuestion}
        className="btn-primary px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Добавить вопрос
      </button>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, addQuestion]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeQuestion = questions.find((q) => q.id === active.id);
    if (!activeQuestion) return;

    let targetTourId: Id<"tours"> | null | undefined;

    if (over.data.current?.tourId !== undefined) {
      targetTourId = over.data.current.tourId;
    } else {
      const overQuestion = questions.find((q) => q.id === over.id);
      if (overQuestion) {
        targetTourId = overQuestion.tourId;
      }
    }

    if (targetTourId !== undefined && activeQuestion.tourId !== targetTourId) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === active.id ? { ...q, tourId: targetTourId as Id<"tours"> | null } : q,
        ),
      );
      setHasChanges(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeQuestion = questions.find((q) => q.id === active.id);
    const overQuestion = questions.find((q) => q.id === over.id);

    if (!activeQuestion) return;

    if (overQuestion && activeQuestion.tourId === overQuestion.tourId) {
      setQuestions((prev) => {
        const tourQuestions = prev.filter((q) => q.tourId === activeQuestion.tourId);
        const oldIndex = tourQuestions.findIndex((q) => q.id === active.id);
        const newIndex = tourQuestions.findIndex((q) => q.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return prev;

        const reordered = [...tourQuestions];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);

        const otherQuestions = prev.filter((q) => q.tourId !== activeQuestion.tourId);
        return [...reordered, ...otherQuestions];
      });
      setHasChanges(true);
    }
  };

  // Loading state
  if (isLoading) {
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
  if (notFound || !pkg) {
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

  const visibleQuestions = questions;
  const activeQuestion = activeId ? questions.find((q) => q.id === activeId) : null;

  // Group questions by tour
  const questionsByTour = new Map<Id<"tours"> | null, QuestionFormData[]>();
  questionsByTour.set(null, []);
  for (const tour of tours) {
    questionsByTour.set(tour.id, []);
  }
  for (const q of visibleQuestions) {
    const tourQuestions = questionsByTour.get(q.tourId) ?? questionsByTour.get(null)!;
    tourQuestions.push(q);
  }

  const hasTours = tours.length > 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Вопросы</h1>
        <span className="text-sm text-muted-foreground">{visibleQuestions.length} вопросов</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 h-full">
            {hasTours ? (
              <>
                {tours.map((tour, idx) => (
                  <TourColumn
                    key={tour.id}
                    tour={tour}
                    index={idx}
                    questions={questionsByTour.get(tour.id) ?? []}
                    onEdit={(id) => router.push(`/${packageId}/grid/${id}`)}
                    onAdd={addQuestion}
                    errors={errors}
                  />
                ))}
                {(questionsByTour.get(null)?.length ?? 0) > 0 && (
                  <NoTourColumn
                    questions={questionsByTour.get(null) ?? []}
                    onEdit={(id) => router.push(`/${packageId}/grid/${id}`)}
                    onAdd={addQuestion}
                    errors={errors}
                  />
                )}
              </>
            ) : (
              <NoTourColumn
                questions={visibleQuestions}
                onEdit={(id) => router.push(`/${packageId}/grid/${id}`)}
                onAdd={addQuestion}
                errors={errors}
              />
            )}
          </div>

          <DragOverlay>
            {activeQuestion ? <QuestionDragOverlay question={activeQuestion} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Save button */}
        {hasChanges && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
