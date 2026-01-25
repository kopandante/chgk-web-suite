"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
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

interface QuestionFormData {
  id: string;
  number: number | null;
  question: string;
  answer: string | null;
  zachet: string | null;
  nezachet: string | null;
  comment: string | null;
  source: string | null;
  author: string | null;
  handout: string | null;
  isNew?: boolean;
  isDeleted?: boolean;
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

  // Initialize form data when data is loaded
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update package metadata
      await updatePackage(packageId, {
        title,
        editor: editor || null,
        date: date || null,
      });

      // Process questions
      for (const q of questions) {
        if (q.isDeleted) {
          await deleteQuestion(q.id);
        } else if (q.isNew) {
          await createQuestion({
            package_id: packageId,
            tour_id: tours?.[0]?.id || null,
            order_num: questions.indexOf(q),
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

      // Update question count
      const activeQuestions = questions.filter((q) => !q.isDeleted);
      await updatePackage(packageId, { question_count: activeQuestions.length });
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

  const updateQuestionField = (
    id: string,
    field: keyof QuestionFormData,
    value: string | number | null,
  ) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
    setHasChanges(true);
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
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isDeleted: true } : q)));
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

  const moveQuestion = (id: string, direction: "up" | "down") => {
    setQuestions((prev) => {
      const visibleQuestions = prev.filter((q) => !q.isDeleted);
      const idx = visibleQuestions.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === visibleQuestions.length - 1) return prev;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      const newVisible = [...visibleQuestions];
      [newVisible[idx], newVisible[swapIdx]] = [newVisible[swapIdx], newVisible[idx]];

      // Rebuild with deleted questions at their original positions
      const deleted = prev.filter((q) => q.isDeleted);
      return [...newVisible, ...deleted];
    });
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
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Назад к просмотру
        </Link>
      </div>

      {/* Package metadata */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold">Метаданные пакета</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Название</span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
              }}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
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
      <div className="space-y-4">
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

        <div className="space-y-2">
          {visibleQuestions.map((q, idx) => (
            <div key={q.id} className="rounded-lg border">
              {/* Question header */}
              <div className="flex items-center gap-2 p-3 w-full hover:bg-muted/50">
                <button
                  type="button"
                  onClick={() => toggleExpanded(q.id)}
                  className="flex items-center gap-2 flex-1 text-left cursor-pointer"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Вопрос {q.number ?? idx + 1}</span>
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {q.question.slice(0, 80)}
                    {q.question.length > 80 ? "..." : ""}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(q.id, "up")}
                    disabled={idx === 0}
                    className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(q.id, "down")}
                    disabled={idx === visibleQuestions.length - 1}
                    className="p-1 hover:bg-muted rounded disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="p-1 hover:bg-destructive/10 text-destructive rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Question form */}
              {expandedQuestions.has(q.id) && (
                <div className="border-t p-4 space-y-4">
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
                      onChange={(e) => updateQuestionField(q.id, "handout", e.target.value || null)}
                      rows={2}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Текст вопроса</span>
                    <textarea
                      value={q.question}
                      onChange={(e) => updateQuestionField(q.id, "question", e.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Ответ</span>
                    <input
                      type="text"
                      value={q.answer ?? ""}
                      onChange={(e) => updateQuestionField(q.id, "answer", e.target.value || null)}
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
                      onChange={(e) => updateQuestionField(q.id, "comment", e.target.value || null)}
                      rows={2}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Источник</span>
                    <textarea
                      value={q.source ?? ""}
                      onChange={(e) => updateQuestionField(q.id, "source", e.target.value || null)}
                      rows={2}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
          </button>
        </div>
      )}
    </div>
  );
}
