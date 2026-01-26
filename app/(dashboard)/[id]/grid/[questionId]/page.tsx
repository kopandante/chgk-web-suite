"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation as useConvexMutation } from "convex/react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HandoutImageUpload } from "@/components/handout-image-upload";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePackageSync } from "@/hooks/use-package-sync";
import {
  type HandoutType,
  isStructuredField,
  prepareQuestionCreate,
  type Question,
  type QuestionFieldValue,
  type QuestionType,
} from "@/lib/db/encrypted-client";
import { type QuestionFormData, questionFormSchema } from "@/lib/schemas/question";
import { useEncryptionStore } from "@/stores/encryption";
import { useHeaderActionsStore } from "@/stores/header-actions";
import { usePackageStore } from "@/stores/package";

function checkDataLoss(
  formData: QuestionFormData,
  newType: QuestionType,
): { hasLoss: boolean; lostItems: string[] } {
  const currentType = formData.type;
  if (currentType === newType) return { hasLoss: false, lostItems: [] };
  if (currentType === "regular") return { hasLoss: false, lostItems: [] };

  const lostItems: string[] = [];
  const question = formData.question;
  const answer = formData.answer;
  const typeLabel = currentType === "duplet" ? "дуплета" : "блица";

  if (newType === "regular") {
    if (isStructuredField(question)) {
      question.items.slice(1).forEach((item, i) => {
        if (item.trim()) lostItems.push(`Вопрос ${typeLabel} ${i + 2}`);
      });
    }
    if (isStructuredField(answer)) {
      answer.items.slice(1).forEach((item, i) => {
        if (item.trim()) lostItems.push(`Ответ ${i + 2}`);
      });
    }
  }

  if (currentType === "blitz" && newType === "duplet") {
    if (isStructuredField(question) && question.items[2]?.trim()) {
      lostItems.push("Вопрос блица 3");
    }
    if (isStructuredField(answer) && answer.items[2]?.trim()) {
      lostItems.push("Ответ 3");
    }
  }

  return { hasLoss: lostItems.length > 0, lostItems };
}

function convertToType(formData: QuestionFormData, newType: QuestionType): QuestionFormData {
  const currentType = formData.type;
  if (currentType === newType) return formData;

  let newQuestion: QuestionFieldValue = formData.question;
  let newAnswer: QuestionFieldValue | null = formData.answer;

  const itemCount = newType === "blitz" ? 3 : newType === "duplet" ? 2 : 1;

  if (newType === "regular") {
    if (isStructuredField(formData.question)) {
      newQuestion = formData.question.items[0] || "";
    }
    if (isStructuredField(formData.answer)) {
      newAnswer = formData.answer.items[0] || "";
    }
  } else if (currentType === "regular") {
    const questionStr = typeof formData.question === "string" ? formData.question : "";
    const answerStr = typeof formData.answer === "string" ? formData.answer : "";

    const header = newType === "duplet" ? "Дуплет." : "Блиц.";
    newQuestion = {
      header,
      items: [questionStr, ...Array(itemCount - 1).fill("")],
    };
    if (answerStr || formData.answer) {
      newAnswer = {
        items: [answerStr, ...Array(itemCount - 1).fill("")],
      };
    }
  } else {
    if (isStructuredField(formData.question)) {
      const header = newType === "duplet" ? "Дуплет." : "Блиц.";
      const items = [...formData.question.items];
      while (items.length < itemCount) items.push("");
      items.length = itemCount;
      newQuestion = { header, items };
    }
    if (isStructuredField(formData.answer)) {
      const items = [...formData.answer.items];
      while (items.length < itemCount) items.push("");
      items.length = itemCount;
      newAnswer = { items };
    }
  }

  return { ...formData, type: newType, question: newQuestion, answer: newAnswer };
}

function fieldToString(value: QuestionFieldValue | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const parts: string[] = [];
  if (value.header) parts.push(value.header);
  value.items.forEach((item, idx) => {
    parts.push(`${idx + 1}. ${item}`);
  });
  return parts.join("\n");
}

export default function EditQuestionPage() {
  const params = useParams();
  const packageId = params.id as Id<"packages">;
  const questionId = params.questionId as string;
  const isNewQuestion = questionId === "new";

  // Sync package data from Convex to store
  const { isLoading, notFound } = usePackageSync(packageId);

  // Read data from store
  const { questions } = usePackageStore();
  const question = useMemo(
    () => (isNewQuestion ? null : questions.find((q) => q.id === questionId)),
    [questions, questionId, isNewQuestion],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="mt-4 font-medium">Загрузка пакета...</p>
      </div>
    );
  }

  if (notFound) {
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

  if (isNewQuestion) {
    // Calculate next question number
    const maxNumber = Math.max(0, ...questions.map((q) => q.number || 0));
    return (
      <NewQuestionForm
        packageId={packageId}
        nextNumber={maxNumber + 1}
        orderNum={questions.length}
      />
    );
  }

  if (!question) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h1 className="text-2xl font-display font-bold">Вопрос не найден</h1>
        <Link
          href={`/${packageId}/grid`}
          className="mt-6 inline-flex items-center gap-2 btn-primary rounded-lg px-5 py-2.5 text-sm"
        >
          Вернуться к редактированию
        </Link>
      </div>
    );
  }

  return <QuestionForm key={questionId} question={question} packageId={packageId} />;
}

function QuestionForm({ question, packageId }: { question: Question; packageId: Id<"packages"> }) {
  const router = useRouter();
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const setHeaderActions = useHeaderActionsStore((state) => state.setActions);
  const { questions, updateQuestion } = usePackageStore();

  const [error, setError] = useState<string | null>(null);
  const [typeChangeDialog, setTypeChangeDialog] = useState<{
    open: boolean;
    newType: QuestionType;
    lostItems: string[];
  }>({ open: false, newType: "regular", lostItems: [] });
  const [leaveDialog, setLeaveDialog] = useState<{
    open: boolean;
    destination: string | null;
  }>({ open: false, destination: null });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const updateQuestionMutation = useConvexMutation(api.questions.update);
  const deleteQuestionMutation = useConvexMutation(api.questions.remove);

  const form = useForm({
    defaultValues: {
      type: question.type,
      number: question.number,
      question: question.question,
      answer: question.answer,
      zachet: question.zachet,
      nezachet: question.nezachet,
      comment: question.comment,
      source: question.source,
      author: question.author,
      handoutType: question.handoutType,
      handout: question.handout,
      handoutImageId: question.handoutImageId,
    } satisfies QuestionFormData,
    validators: {
      onSubmit: questionFormSchema,
    },
    onSubmit: async ({ value }) => {
      await saveChanges(value);
    },
  });

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.order_num - b.order_num),
    [questions],
  );
  const questionIds = useMemo(() => sortedQuestions.map((q) => q.id), [sortedQuestions]);

  const currentIndex = questionIds.indexOf(question.id);
  const prevQuestionId = currentIndex > 0 ? questionIds[currentIndex - 1] : null;
  const nextQuestionId =
    currentIndex < questionIds.length - 1 ? questionIds[currentIndex + 1] : null;

  const safeNavigate = useCallback(
    (destination: string) => {
      if (form.state.isDirty) {
        setLeaveDialog({ open: true, destination });
      } else {
        router.push(destination);
      }
    },
    [form.state.isDirty, router],
  );

  const goToPrev = useCallback(() => {
    if (prevQuestionId) {
      safeNavigate(`/${packageId}/grid/${prevQuestionId}`);
    }
  }, [prevQuestionId, packageId, safeNavigate]);

  const goToNext = useCallback(() => {
    if (nextQuestionId) {
      safeNavigate(`/${packageId}/grid/${nextQuestionId}`);
    }
  }, [nextQuestionId, packageId, safeNavigate]);

  const handleSaveAndLeave = async () => {
    await form.handleSubmit();
    if (leaveDialog.destination) {
      router.push(leaveDialog.destination);
    }
    setLeaveDialog({ open: false, destination: null });
  };

  const handleDiscard = () => {
    form.reset();
    if (leaveDialog.destination) {
      router.push(leaveDialog.destination);
    }
    setLeaveDialog({ open: false, destination: null });
  };

  const confirmDelete = useCallback(async () => {
    try {
      await deleteQuestionMutation({ id: question.id });
      toast.success("Вопрос удален");
      router.push(`/${packageId}/grid`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeleteDialogOpen(false);
    }
  }, [deleteQuestionMutation, question.id, packageId, router]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key === "ArrowLeft" && prevQuestionId) {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight" && nextQuestionId) {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevQuestionId, nextQuestionId, goToPrev, goToNext]);

  // beforeunload handler
  useEffect(() => {
    if (!form.state.isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return "Есть несохраненные изменения";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.state.isDirty]);

  // Header actions
  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => form.handleSubmit()}
          disabled={!form.state.isDirty || form.state.isSubmitting}
        >
          {form.state.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="ml-1.5">Сохранить</span>
        </Button>
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="rounded-lg border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Удалить
        </button>
      </div>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, form.state.isDirty, form.state.isSubmitting, form]);

  const saveChanges = useCallback(
    async (data: QuestionFormData) => {
      if (!masterKey) return;

      const questionText =
        typeof data.question === "string"
          ? data.question
          : isStructuredField(data.question)
            ? data.question.items[0] || ""
            : "";

      if (!questionText.trim()) {
        setError("Текст вопроса обязателен");
        return;
      }

      try {
        const questionData = await prepareQuestionCreate(masterKey, {
          type: data.type,
          number: data.number ?? undefined,
          question: data.question,
          answer: data.answer ?? undefined,
          zachet: data.zachet ?? undefined,
          nezachet: data.nezachet ?? undefined,
          comment: data.comment ?? undefined,
          source: data.source ?? undefined,
          author: data.author ?? undefined,
          handoutType: data.handoutType,
          handout: data.handout ?? undefined,
          handoutImageId: data.handoutImageId ?? undefined,
        });

        await updateQuestionMutation({
          id: question.id,
          encryptedData: questionData.encryptedData,
          iv: questionData.iv,
        });

        // Update store
        updateQuestion(question.id, {
          type: data.type,
          number: data.number,
          question: data.question,
          answer: data.answer,
          zachet: data.zachet,
          nezachet: data.nezachet,
          comment: data.comment,
          source: data.source,
          author: data.author,
          handoutType: data.handoutType,
          handout: data.handout,
          handoutImageId: data.handoutImageId,
        });

        form.reset(data);
        toast.success("Сохранено");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
      }
    },
    [masterKey, question.id, updateQuestionMutation, updateQuestion, form],
  );

  const handleTypeChange = (newType: QuestionType) => {
    const currentValues = form.state.values;
    if (currentValues.type === newType) return;

    const { hasLoss, lostItems } = checkDataLoss(currentValues, newType);

    if (hasLoss) {
      setTypeChangeDialog({ open: true, newType, lostItems });
    } else {
      applyTypeChange(newType);
    }
  };

  const applyTypeChange = (newType: QuestionType) => {
    const currentValues = form.state.values;
    const converted = convertToType(currentValues, newType);
    form.setFieldValue("type", converted.type);
    form.setFieldValue("question", converted.question);
    form.setFieldValue("answer", converted.answer);
    setTypeChangeDialog({ open: false, newType: "regular", lostItems: [] });
  };

  const handleHandoutTypeChange = (newType: HandoutType) => {
    const currentType = form.state.values.handoutType;
    if (currentType === newType) return;

    form.setFieldValue("handoutType", newType);

    if (newType === "none") {
      form.setFieldValue("handout", null);
      form.setFieldValue("handoutImageId", null);
    } else if (newType === "text") {
      form.setFieldValue("handoutImageId", null);
    } else if (newType === "image") {
      form.setFieldValue("handout", null);
    }
  };

  const formValues = form.state.values;
  const isStructured = formValues.type !== "regular";
  const itemCount = formValues.type === "blitz" ? 3 : formValues.type === "duplet" ? 2 : 1;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => safeNavigate(`/${packageId}/grid`)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Вопрос #{formValues.number ?? "?"}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrev}
            disabled={!prevQuestionId}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Предыдущий вопрос"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-muted-foreground px-2">
            {currentIndex + 1} / {questionIds.length}
          </span>
          <button
            type="button"
            onClick={goToNext}
            disabled={!nextQuestionId}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Следующий вопрос"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Type switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
        {(["regular", "duplet", "blitz"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              formValues.type === type
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {type === "regular" ? "Обычный" : type === "duplet" ? "Дуплет" : "Блиц"}
          </button>
        ))}
      </div>

      {/* Data loss confirmation dialog */}
      <AlertDialog
        open={typeChangeDialog.open}
        onOpenChange={(open) => setTypeChangeDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Потеря данных</AlertDialogTitle>
            <AlertDialogDescription>
              При переключении типа будут удалены:
              <ul className="list-disc list-inside mt-2">
                {typeChangeDialog.lostItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setTypeChangeDialog((prev) => ({ ...prev, open: false }))}
            >
              Отмена
            </Button>
            <Button onClick={() => applyTypeChange(typeChangeDialog.newType)}>Продолжить</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave confirmation dialog */}
      <AlertDialog
        open={leaveDialog.open}
        onOpenChange={(open) => !open && setLeaveDialog({ open: false, destination: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Несохраненные изменения</AlertDialogTitle>
            <AlertDialogDescription>
              У вас есть несохраненные изменения. Сохранить их перед уходом?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setLeaveDialog({ open: false, destination: null })}
            >
              Отмена
            </Button>
            <Button variant="outline" onClick={handleDiscard}>
              Не сохранять
            </Button>
            <Button onClick={handleSaveAndLeave}>Сохранить</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вопрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Вопрос #{formValues.number ?? "?"} будет удален. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2">
          <form.Field name="number">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Номер</span>
                <input
                  type="number"
                  value={field.state.value ?? ""}
                  onChange={(e) =>
                    field.handleChange(e.target.value ? Number.parseInt(e.target.value, 10) : null)
                  }
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
          <form.Field name="author">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Автор</span>
                <input
                  type="text"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
        </div>

        {/* Handout type switcher */}
        <div className="space-y-2">
          <span className="text-sm font-medium block">Раздатка</span>
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {(["none", "text", "image"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleHandoutTypeChange(type)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  formValues.handoutType === type
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type === "none" ? "Нет" : type === "text" ? "Текст" : "Изображение"}
              </button>
            ))}
          </div>

          {formValues.handoutType === "text" && (
            <form.Field name="handout">
              {(field) => (
                <textarea
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  rows={2}
                  placeholder="Текст раздатки..."
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              )}
            </form.Field>
          )}

          {formValues.handoutType === "image" && (
            <form.Field name="handoutImageId">
              {(field) => (
                <HandoutImageUpload
                  questionId={question.id}
                  imageId={field.state.value}
                  onUpload={(imageId) => field.handleChange(imageId)}
                  onRemove={() => field.handleChange(null)}
                />
              )}
            </form.Field>
          )}
        </div>

        {/* Question field */}
        {isStructured && isStructuredField(formValues.question) ? (
          (() => {
            const structuredQuestion = formValues.question;
            return (
              <div className="space-y-3">
                <span className="text-sm font-medium block">
                  Текст вопроса <span className="text-destructive">*</span>
                </span>
                <label className="block">
                  <span className="text-xs text-muted-foreground">Вступление</span>
                  <textarea
                    value={structuredQuestion.header ?? ""}
                    onChange={(e) => {
                      const newQuestion = {
                        ...structuredQuestion,
                        header: e.target.value || undefined,
                      };
                      form.setFieldValue("question", newQuestion);
                    }}
                    rows={2}
                    placeholder={formValues.type === "duplet" ? "Дуплет." : "Блиц."}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </label>
                {Array.from({ length: itemCount }).map((_, idx) => (
                  <label key={idx} className="block">
                    <span className="text-xs text-muted-foreground">
                      Вопрос {formValues.type === "duplet" ? "дуплета" : "блица"} {idx + 1}
                    </span>
                    <textarea
                      value={structuredQuestion.items[idx] ?? ""}
                      onChange={(e) => {
                        const newItems = [...structuredQuestion.items];
                        newItems[idx] = e.target.value;
                        form.setFieldValue("question", {
                          ...structuredQuestion,
                          items: newItems,
                        });
                      }}
                      rows={4}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                        idx === 0 && error ? "border-destructive" : ""
                      }`}
                    />
                  </label>
                ))}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            );
          })()
        ) : (
          <form.Field name="question">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">
                  Текст вопроса <span className="text-destructive">*</span>
                </span>
                <textarea
                  value={typeof field.state.value === "string" ? field.state.value : ""}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    if (error) setError(null);
                  }}
                  onBlur={field.handleBlur}
                  rows={6}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                    error ? "border-destructive" : ""
                  }`}
                />
                {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              </label>
            )}
          </form.Field>
        )}

        {/* Answer field */}
        {isStructured && isStructuredField(formValues.answer) ? (
          (() => {
            const structuredAnswer = formValues.answer;
            return (
              <div className="space-y-3">
                <span className="text-sm font-medium block">Ответы</span>
                {Array.from({ length: itemCount }).map((_, idx) => (
                  <label key={idx} className="block">
                    <span className="text-xs text-muted-foreground">Ответ {idx + 1}</span>
                    <input
                      type="text"
                      value={structuredAnswer.items[idx] ?? ""}
                      onChange={(e) => {
                        const newItems = [...structuredAnswer.items];
                        newItems[idx] = e.target.value;
                        form.setFieldValue("answer", {
                          ...structuredAnswer,
                          items: newItems,
                        });
                      }}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
            );
          })()
        ) : (
          <form.Field name="answer">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Ответ</span>
                <input
                  type="text"
                  value={
                    typeof field.state.value === "string"
                      ? field.state.value
                      : (fieldToString(field.state.value) ?? "")
                  }
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
        )}

        <div className="grid gap-4 grid-cols-2">
          <form.Field name="zachet">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Зачет</span>
                <input
                  type="text"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
          <form.Field name="nezachet">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Незачет</span>
                <input
                  type="text"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
        </div>

        <form.Field name="comment">
          {(field) => (
            <label className="block">
              <span className="text-sm font-medium">Комментарий</span>
              <textarea
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value || null)}
                onBlur={field.handleBlur}
                rows={6}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          )}
        </form.Field>

        <form.Field name="source">
          {(field) => (
            <label className="block">
              <span className="text-sm font-medium">Источник</span>
              <textarea
                value={
                  Array.isArray(field.state.value)
                    ? field.state.value.join("\n")
                    : (field.state.value ?? "")
                }
                onChange={(e) => field.handleChange(e.target.value || null)}
                onBlur={field.handleBlur}
                rows={2}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          )}
        </form.Field>
      </div>
    </div>
  );
}

function NewQuestionForm({
  packageId,
  nextNumber,
  orderNum,
}: {
  packageId: Id<"packages">;
  nextNumber: number;
  orderNum: number;
}) {
  const router = useRouter();
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const setHeaderActions = useHeaderActionsStore((state) => state.setActions);

  const [error, setError] = useState<string | null>(null);
  const [typeChangeDialog, setTypeChangeDialog] = useState<{
    open: boolean;
    newType: QuestionType;
    lostItems: string[];
  }>({ open: false, newType: "regular", lostItems: [] });
  const [leaveDialog, setLeaveDialog] = useState<{
    open: boolean;
    destination: string | null;
  }>({ open: false, destination: null });

  const createQuestionMutation = useConvexMutation(api.questions.create);

  const form = useForm({
    defaultValues: {
      type: "regular" as QuestionType,
      number: nextNumber as number | null,
      question: "" as QuestionFieldValue,
      answer: null as QuestionFieldValue | null,
      zachet: null as string | null,
      nezachet: null as string | null,
      comment: null as string | null,
      source: null as string | string[] | null,
      author: null as string | null,
      handoutType: "none" as HandoutType,
      handout: null as string | null,
      handoutImageId: null as string | null,
    } satisfies QuestionFormData,
    validators: {
      onSubmit: questionFormSchema,
    },
    onSubmit: async ({ value }) => {
      await createQuestion(value);
    },
  });

  const safeNavigate = useCallback(
    (destination: string) => {
      if (form.state.isDirty) {
        setLeaveDialog({ open: true, destination });
      } else {
        router.push(destination);
      }
    },
    [form.state.isDirty, router],
  );

  const handleSaveAndLeave = async () => {
    await form.handleSubmit();
  };

  const handleDiscard = () => {
    form.reset();
    if (leaveDialog.destination) {
      router.push(leaveDialog.destination);
    }
    setLeaveDialog({ open: false, destination: null });
  };

  // beforeunload handler
  useEffect(() => {
    if (!form.state.isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return "Есть несохраненные изменения";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.state.isDirty]);

  // Header actions
  useEffect(() => {
    setHeaderActions(
      <Button
        variant="outline"
        size="sm"
        onClick={() => form.handleSubmit()}
        disabled={!form.state.isDirty || form.state.isSubmitting}
      >
        {form.state.isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        <span className="ml-1.5">Создать</span>
      </Button>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, form.state.isDirty, form.state.isSubmitting, form]);

  const createQuestion = useCallback(
    async (data: QuestionFormData) => {
      if (!masterKey) return;

      const questionText =
        typeof data.question === "string"
          ? data.question
          : isStructuredField(data.question)
            ? data.question.items[0] || ""
            : "";

      if (!questionText.trim()) {
        setError("Текст вопроса обязателен");
        return;
      }

      try {
        const questionData = await prepareQuestionCreate(masterKey, {
          type: data.type,
          number: data.number ?? undefined,
          question: data.question,
          answer: data.answer ?? undefined,
          zachet: data.zachet ?? undefined,
          nezachet: data.nezachet ?? undefined,
          comment: data.comment ?? undefined,
          source: data.source ?? undefined,
          author: data.author ?? undefined,
          handoutType: data.handoutType,
          handout: data.handout ?? undefined,
          handoutImageId: data.handoutImageId ?? undefined,
        });

        const newId = await createQuestionMutation({
          packageId,
          encryptedData: questionData.encryptedData,
          iv: questionData.iv,
          orderNum,
        });

        toast.success("Вопрос создан");

        // Navigate to the created question or back to grid
        if (leaveDialog.destination) {
          router.push(leaveDialog.destination);
        } else {
          router.replace(`/${packageId}/grid/${newId}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка создания");
      }
    },
    [masterKey, packageId, orderNum, createQuestionMutation, router, leaveDialog.destination],
  );

  const handleTypeChange = (newType: QuestionType) => {
    const currentValues = form.state.values;
    if (currentValues.type === newType) return;

    const { hasLoss, lostItems } = checkDataLoss(currentValues, newType);

    if (hasLoss) {
      setTypeChangeDialog({ open: true, newType, lostItems });
    } else {
      applyTypeChange(newType);
    }
  };

  const applyTypeChange = (newType: QuestionType) => {
    const currentValues = form.state.values;
    const converted = convertToType(currentValues, newType);
    form.setFieldValue("type", converted.type);
    form.setFieldValue("question", converted.question);
    form.setFieldValue("answer", converted.answer);
    setTypeChangeDialog({ open: false, newType: "regular", lostItems: [] });
  };

  const handleHandoutTypeChange = (newType: HandoutType) => {
    const currentType = form.state.values.handoutType;
    if (currentType === newType) return;

    form.setFieldValue("handoutType", newType);

    if (newType === "none") {
      form.setFieldValue("handout", null);
      form.setFieldValue("handoutImageId", null);
    } else if (newType === "text") {
      form.setFieldValue("handoutImageId", null);
    } else if (newType === "image") {
      form.setFieldValue("handout", null);
    }
  };

  const formValues = form.state.values;
  const isStructured = formValues.type !== "regular";
  const itemCount = formValues.type === "blitz" ? 3 : formValues.type === "duplet" ? 2 : 1;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => safeNavigate(`/${packageId}/grid`)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Новый вопрос</h1>
        </div>
      </div>

      {/* Type switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
        {(["regular", "duplet", "blitz"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              formValues.type === type
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {type === "regular" ? "Обычный" : type === "duplet" ? "Дуплет" : "Блиц"}
          </button>
        ))}
      </div>

      {/* Data loss confirmation dialog */}
      <AlertDialog
        open={typeChangeDialog.open}
        onOpenChange={(open) => setTypeChangeDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Потеря данных</AlertDialogTitle>
            <AlertDialogDescription>
              При переключении типа будут удалены:
              <ul className="list-disc list-inside mt-2">
                {typeChangeDialog.lostItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setTypeChangeDialog((prev) => ({ ...prev, open: false }))}
            >
              Отмена
            </Button>
            <Button onClick={() => applyTypeChange(typeChangeDialog.newType)}>Продолжить</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave confirmation dialog */}
      <AlertDialog
        open={leaveDialog.open}
        onOpenChange={(open) => !open && setLeaveDialog({ open: false, destination: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Несохраненные изменения</AlertDialogTitle>
            <AlertDialogDescription>
              У вас есть несохраненные изменения. Сохранить их перед уходом?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setLeaveDialog({ open: false, destination: null })}
            >
              Отмена
            </Button>
            <Button variant="outline" onClick={handleDiscard}>
              Не сохранять
            </Button>
            <Button onClick={handleSaveAndLeave}>Сохранить</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2">
          <form.Field name="number">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Номер</span>
                <input
                  type="number"
                  value={field.state.value ?? ""}
                  onChange={(e) =>
                    field.handleChange(e.target.value ? Number.parseInt(e.target.value, 10) : null)
                  }
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
          <form.Field name="author">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Автор</span>
                <input
                  type="text"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
        </div>

        {/* Handout type switcher */}
        <div className="space-y-2">
          <span className="text-sm font-medium block">Раздатка</span>
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {(["none", "text", "image"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleHandoutTypeChange(type)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  formValues.handoutType === type
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type === "none" ? "Нет" : type === "text" ? "Текст" : "Изображение"}
              </button>
            ))}
          </div>

          {formValues.handoutType === "text" && (
            <form.Field name="handout">
              {(field) => (
                <textarea
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  rows={2}
                  placeholder="Текст раздатки..."
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              )}
            </form.Field>
          )}
        </div>

        {/* Question field */}
        {isStructured && isStructuredField(formValues.question) ? (
          (() => {
            const structuredQuestion = formValues.question;
            return (
              <div className="space-y-3">
                <span className="text-sm font-medium block">
                  Текст вопроса <span className="text-destructive">*</span>
                </span>
                <label className="block">
                  <span className="text-xs text-muted-foreground">Вступление</span>
                  <textarea
                    value={structuredQuestion.header ?? ""}
                    onChange={(e) => {
                      const newQuestion = {
                        ...structuredQuestion,
                        header: e.target.value || undefined,
                      };
                      form.setFieldValue("question", newQuestion);
                    }}
                    rows={2}
                    placeholder={formValues.type === "duplet" ? "Дуплет." : "Блиц."}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </label>
                {Array.from({ length: itemCount }).map((_, idx) => (
                  <label key={idx} className="block">
                    <span className="text-xs text-muted-foreground">
                      Вопрос {formValues.type === "duplet" ? "дуплета" : "блица"} {idx + 1}
                    </span>
                    <textarea
                      value={structuredQuestion.items[idx] ?? ""}
                      onChange={(e) => {
                        const newItems = [...structuredQuestion.items];
                        newItems[idx] = e.target.value;
                        form.setFieldValue("question", {
                          ...structuredQuestion,
                          items: newItems,
                        });
                      }}
                      rows={4}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                        idx === 0 && error ? "border-destructive" : ""
                      }`}
                    />
                  </label>
                ))}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            );
          })()
        ) : (
          <form.Field name="question">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">
                  Текст вопроса <span className="text-destructive">*</span>
                </span>
                <textarea
                  value={typeof field.state.value === "string" ? field.state.value : ""}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    if (error) setError(null);
                  }}
                  onBlur={field.handleBlur}
                  rows={6}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                    error ? "border-destructive" : ""
                  }`}
                />
                {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              </label>
            )}
          </form.Field>
        )}

        {/* Answer field */}
        {isStructured && isStructuredField(formValues.answer) ? (
          (() => {
            const structuredAnswer = formValues.answer;
            return (
              <div className="space-y-3">
                <span className="text-sm font-medium block">Ответы</span>
                {Array.from({ length: itemCount }).map((_, idx) => (
                  <label key={idx} className="block">
                    <span className="text-xs text-muted-foreground">Ответ {idx + 1}</span>
                    <input
                      type="text"
                      value={structuredAnswer.items[idx] ?? ""}
                      onChange={(e) => {
                        const newItems = [...structuredAnswer.items];
                        newItems[idx] = e.target.value;
                        form.setFieldValue("answer", {
                          ...structuredAnswer,
                          items: newItems,
                        });
                      }}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
            );
          })()
        ) : (
          <form.Field name="answer">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Ответ</span>
                <input
                  type="text"
                  value={
                    typeof field.state.value === "string"
                      ? field.state.value
                      : (fieldToString(field.state.value) ?? "")
                  }
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
        )}

        <div className="grid gap-4 grid-cols-2">
          <form.Field name="zachet">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Зачет</span>
                <input
                  type="text"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
          <form.Field name="nezachet">
            {(field) => (
              <label className="block">
                <span className="text-sm font-medium">Незачет</span>
                <input
                  type="text"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  onBlur={field.handleBlur}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
            )}
          </form.Field>
        </div>

        <form.Field name="comment">
          {(field) => (
            <label className="block">
              <span className="text-sm font-medium">Комментарий</span>
              <textarea
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value || null)}
                onBlur={field.handleBlur}
                rows={6}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          )}
        </form.Field>

        <form.Field name="source">
          {(field) => (
            <label className="block">
              <span className="text-sm font-medium">Источник</span>
              <textarea
                value={
                  Array.isArray(field.state.value)
                    ? field.state.value.join("\n")
                    : (field.state.value ?? "")
                }
                onChange={(e) => field.handleChange(e.target.value || null)}
                onBlur={field.handleBlur}
                rows={2}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
          )}
        </form.Field>
      </div>
    </div>
  );
}
