"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { FormatSource, FormatText } from "@/components/format-text";
import {
  deletePackage,
  getPackage,
  getQuestionsByPackage,
  getToursByPackage,
} from "@/lib/db/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PackagePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const packageId = params.id as string;
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => deletePackage(packageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      router.push("/packages");
    },
  });

  const { data: pkg, isLoading: pkgLoading } = useQuery({
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

  const filteredQuestions = selectedTourId
    ? questions?.filter((q) => q.tour_id === selectedTourId)
    : questions;

  if (pkgLoading) {
    return <div>Загрузка...</div>;
  }

  if (!pkg) {
    return <div>Пакет не найден</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pkg.title}</h1>
          {pkg.editor && <p className="text-muted-foreground">{pkg.editor}</p>}
          <p className="text-sm text-muted-foreground">
            {pkg.question_count} вопросов{pkg.tour_count > 0 ? `, ${pkg.tour_count} туров` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/packages/${packageId}/edit`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Edit className="h-4 w-4" />
            Редактировать
          </Link>
          <Link
            href={`/packages/${packageId}/export`}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Экспорт
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить пакет?</AlertDialogTitle>
                <AlertDialogDescription>
                  Пакет &quot;{pkg.title}&quot; будет удален вместе со всеми вопросами. Это действие
                  нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tours */}
      {tours && tours.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Туры</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTourId(null)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                selectedTourId === null
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-accent"
              }`}
            >
              Все вопросы
            </button>
            {tours.map((tour, index) => (
              <button
                type="button"
                key={tour.id}
                onClick={() => setSelectedTourId(tour.id)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  selectedTourId === tour.id
                    ? "bg-primary text-primary-foreground"
                    : "border hover:bg-accent"
                }`}
              >
                {tour.title || `Тур ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      {filteredQuestions && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Вопросы ({filteredQuestions.length}
            {selectedTourId && questions ? ` из ${questions.length}` : ""})
          </h2>
          <div className="space-y-4">
            {filteredQuestions.map((question, index) => (
              <div key={question.id} className="rounded-lg border p-4 space-y-2">
                <div className="text-sm text-muted-foreground font-medium">
                  Вопрос {question.number ?? index + 1}
                </div>
                <div className="whitespace-pre-wrap">
                  <FormatText text={question.question} />
                </div>
                {question.answer && (
                  <div className="pt-2 border-t">
                    <span className="text-sm font-medium text-muted-foreground">Ответ: </span>
                    <FormatText text={question.answer} />
                  </div>
                )}
                {question.zachet && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Зачет: </span>
                    <FormatText text={question.zachet} />
                  </div>
                )}
                {question.source && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Источник: </span>
                    <FormatSource source={question.source} />
                  </div>
                )}
                {question.comment && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Комментарий: </span>
                    <FormatText text={question.comment} />
                  </div>
                )}
                {question.author && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Автор: </span>
                    <FormatText text={question.author} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
