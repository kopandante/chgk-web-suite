"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createQuestion,
  deleteQuestion,
  getPackage,
  getQuestionsByPackage,
  getToursByPackage,
  updatePackage,
  updateQuestion,
} from "@/lib/db/client";
import type { QuestionFormData } from "@/lib/validation/schemas";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-background">
      <div className="flex items-center gap-2 p-3 w-full">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function EditPackagePage() {
  const params = useParams();
  const packageId = params.id as string;
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [editor, setEditor] = useState("");
  const [date, setDate] = useState("");
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; questions?: Record<string, string> }>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data: pkg, isLoading: pkgLoading } = useQuery({
    queryKey: ["package", packageId],
    queryFn: () => getPackage(packageId),
  });

  const { data: dbQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: ["questions", packageId],
    queryFn: () => getQuestionsByPackage(packageId),
    enabled: !!pkg,
  });

  const { data: tours } = useQuery({
    queryKey: ["tours", packageId],
    queryFn: () => getToursByPackage(packageId),
    enabled: !!pkg,
  });

  // Initialize form when data loads
  useEffect(() => {
    if (pkg && dbQuestions && !initialized) {
      setTitle(pkg.title);
      setEditor(pkg.editor || "");
      setDate(pkg.date || "");
      setQuestions(
        dbQuestions.map((q) => ({
          id: q.id,
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
  }, [pkg, dbQuestions, initialized]);

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!title.trim()) {
      newErrors.title = "Название обязательно";
    }

    const questionErrors: Record<string, string> = {};
    for (const q of questions.filter((q) => !q.isDeleted)) {
      if (!q.question.trim()) {
        questionErrors[q.id] = "Текст вопроса обязателен";
      }
    }
    if (Object.keys(questionErrors).length > 0) {
      newErrors.questions = questionErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updatePackage(packageId, {
        title,
        editor: editor || null,
        date: date || null,
      });

      for (const q of questions) {
        if (q.isDeleted) {
          await deleteQuestion(q.id);
        } else if (q.isNew) {
          await createQuestion({
            package_id: packageId,
            tour_id: tours?.[0]?.id || undefined,
            order_num: questions.indexOf(q),
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
        } else {
          await updateQuestion(q.id, {
            number: q.number,
            question: q.question,
            answer: q.answer,
            zachet: q.zachet,
            nezachet: q.nezachet,
            comment: q.comment,
            source: q.source,
            author: q.author,
            handout: q.handout,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package", packageId] });
      queryClient.invalidateQueries({ queryKey: ["questions", packageId] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setHasChanges(false);
      toast.success("Изменения сохранены");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      saveMutation.mutate();
    }
  };

  const updateQuestionField = <K extends keyof QuestionFormData>(
    id: string,
    field: K,
    value: QuestionFormData[K],
  ) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
    setHasChanges(true);
    // Clear error for this question
    if (errors.questions?.[id]) {
      setErrors((prev) => {
        const { [id]: _, ...rest } = prev.questions || {};
        return { ...prev, questions: Object.keys(rest).length > 0 ? rest : undefined };
      });
    }
  };

  const addQuestion = () => {
    const newId = `new-${Date.now()}`;
    const maxNumber = Math.max(
      0,
      ...questions.filter((q) => !q.isDeleted).map((q) => q.number || 0),
    );
    setQuestions((prev) => [
      ...prev,
      {
        id: newId,
        number: maxNumber + 1,
        question: "",
        answer: null,
        zachet: null,
        nezachet: null,
        comment: null,
        source: null,
        author: null,
        handout: null,
        isNew: true,
      },
    ]);
    setExpandedQuestions((prev) => new Set([...prev, newId]));
    setHasChanges(true);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) =>
      prev
        .map((q) => (q.id === id ? { ...q, isDeleted: true } : q))
        .filter((q) => !(q.isNew && q.isDeleted)),
    );
    setHasChanges(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const visibleQuestions = questions.filter((q) => !q.isDeleted);
    const oldIndex = visibleQuestions.findIndex((q) => q.id === active.id);
    const newIndex = visibleQuestions.findIndex((q) => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...visibleQuestions];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const deleted = questions.filter((q) => q.isDeleted);
    setQuestions([...reordered, ...deleted]);
    setHasChanges(true);
  };

  if (pkgLoading || questionsLoading) {
    return <div>Загрузка...</div>;
  }

  if (!pkg) {
    return <div>Пакет не найден</div>;
  }

  const visibleQuestions = questions.filter((q) => !q.isDeleted);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Редактирование пакета</h1>
        <Link
          href={`/${packageId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к пакету
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Package metadata */}
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold">Метаданные пакета</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">
                Название <span className="text-destructive">*</span>
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                  errors.title ? "border-destructive" : ""
                }`}
              />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
            </label>

            <label className="block">
              <span className="text-sm font-medium">Редактор</span>
              <input
                type="text"
                value={editor}
                onChange={(e) => {
                  setEditor(e.target.value);
                  setHasChanges(true);
                }}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Дата</span>
              <input
                type="text"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setHasChanges(true);
                }}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="например: 2024-01-01"
              />
            </label>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Вопросы ({visibleQuestions.length})</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Добавить вопрос
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleQuestions.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {visibleQuestions.map((q, visibleIdx) => (
                  <SortableItem key={q.id} id={q.id}>
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(q.id)}
                        className="flex items-center gap-2 flex-1 text-left cursor-pointer hover:bg-muted/50 -m-2 p-2 rounded"
                      >
                        <span className="font-medium text-sm">
                          Вопрос {q.number ?? visibleIdx + 1}
                        </span>
                        <span className="text-sm text-muted-foreground truncate flex-1">
                          {q.question.slice(0, 80)}
                          {q.question.length > 80 ? "..." : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        className="p-1 hover:bg-destructive/10 text-destructive rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {expandedQuestions.has(q.id) && (
                      <div className="border-t mt-3 pt-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <span className="text-sm font-medium">Номер</span>
                            <input
                              type="number"
                              value={q.number ?? ""}
                              onChange={(e) =>
                                updateQuestionField(
                                  q.id,
                                  "number",
                                  e.target.value ? Number.parseInt(e.target.value, 10) : null,
                                )
                              }
                              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium">Автор</span>
                            <input
                              type="text"
                              value={q.author ?? ""}
                              onChange={(e) =>
                                updateQuestionField(q.id, "author", e.target.value || null)
                              }
                              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-sm font-medium">Раздатка</span>
                          <textarea
                            value={q.handout ?? ""}
                            onChange={(e) =>
                              updateQuestionField(q.id, "handout", e.target.value || null)
                            }
                            rows={2}
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium">
                            Текст вопроса <span className="text-destructive">*</span>
                          </span>
                          <textarea
                            value={q.question}
                            onChange={(e) => updateQuestionField(q.id, "question", e.target.value)}
                            rows={4}
                            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                              errors.questions?.[q.id] ? "border-destructive" : ""
                            }`}
                          />
                          {errors.questions?.[q.id] && (
                            <p className="mt-1 text-xs text-destructive">
                              {errors.questions[q.id]}
                            </p>
                          )}
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium">Ответ</span>
                          <input
                            type="text"
                            value={q.answer ?? ""}
                            onChange={(e) =>
                              updateQuestionField(q.id, "answer", e.target.value || null)
                            }
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                          />
                        </label>

                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <span className="text-sm font-medium">Зачет</span>
                            <input
                              type="text"
                              value={q.zachet ?? ""}
                              onChange={(e) =>
                                updateQuestionField(q.id, "zachet", e.target.value || null)
                              }
                              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium">Незачет</span>
                            <input
                              type="text"
                              value={q.nezachet ?? ""}
                              onChange={(e) =>
                                updateQuestionField(q.id, "nezachet", e.target.value || null)
                              }
                              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-sm font-medium">Комментарий</span>
                          <textarea
                            value={q.comment ?? ""}
                            onChange={(e) =>
                              updateQuestionField(q.id, "comment", e.target.value || null)
                            }
                            rows={2}
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium">Источник</span>
                          <textarea
                            value={q.source ?? ""}
                            onChange={(e) =>
                              updateQuestionField(q.id, "source", e.target.value || null)
                            }
                            rows={2}
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Save button */}
        {hasChanges && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
