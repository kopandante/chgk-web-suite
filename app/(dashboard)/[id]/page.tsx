"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import { ArrowLeft, Download, Edit, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormatSource, FormatText } from "@/components/format-text";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  decryptPackage,
  decryptQuestions,
  decryptTours,
  type Package,
  type Question,
  type Tour,
} from "@/lib/db/encrypted-client";
import { useEncryptionStore } from "@/stores/encryption";

function QuestionCard({ question, index }: { question: Question; index: number }) {
  return (
    <div className="library-card p-5 space-y-3">
      <div className="text-sm text-primary font-medium small-caps">
        Вопрос {question.number ?? index + 1}
      </div>
      {question.handout && (
        <div className="bg-muted/50 rounded-lg p-4 text-sm border-l-2 border-accent">
          <span className="font-medium text-muted-foreground">Раздатка: </span>
          <FormatText text={question.handout} />
        </div>
      )}
      <div className="whitespace-pre-wrap text-base leading-relaxed">
        <FormatText text={question.question} />
      </div>
      {question.answer && (
        <div className="pt-3 border-t">
          <span className="text-sm font-medium text-primary">Ответ: </span>
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
  );
}

function VirtualizedQuestionList({ questions }: { questions: Question[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: questions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="h-[calc(100vh-22rem)] overflow-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {items.map((virtualItem) => {
          const question = questions[virtualItem.index];
          return (
            <div
              key={question.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full pb-4"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <QuestionCard question={question} index={virtualItem.index} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PackagePage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params.id as Id<"packages">;
  const masterKey = useEncryptionStore((state) => state.masterKey);

  const [pkg, setPkg] = useState<Package | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<Id<"tours"> | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(true);

  // Convex queries
  const encryptedPkg = useConvexQuery(api.packages.get, { id: packageId });
  const encryptedQuestions = useConvexQuery(api.questions.listByPackage, { packageId });
  const encryptedTours = useConvexQuery(api.tours.listByPackage, { packageId });

  // Convex mutation for delete
  const deletePackageMutation = useConvexMutation(api.packages.remove);

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

  const handleDelete = async () => {
    await deletePackageMutation({ id: packageId });
    router.push("/packages");
  };

  const filteredQuestions = selectedTourId
    ? questions.filter((q) => q.tour_id === selectedTourId)
    : questions;

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
        <p className="mt-2 text-muted-foreground">
          Возможно, он был удален или у вас нет к нему доступа.
        </p>
        <Link
          href="/packages"
          className="mt-6 inline-flex items-center gap-2 btn-primary rounded-lg px-5 py-2.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Вернуться к пакетам
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Link
        href="/packages"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Все пакеты
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            {pkg.title}
          </h1>
          {pkg.editor && <p className="mt-2 text-lg text-muted-foreground">{pkg.editor}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {pkg.question_count}{" "}
            {pkg.question_count === 1 ? "вопрос" : pkg.question_count < 5 ? "вопроса" : "вопросов"}
            {pkg.tour_count > 0 &&
              `, ${pkg.tour_count} ${pkg.tour_count === 1 ? "тур" : pkg.tour_count < 5 ? "тура" : "туров"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${packageId}/edit`}
            className="inline-flex items-center gap-2 btn-outline rounded-lg px-4 py-2.5 text-sm"
          >
            <Edit className="h-4 w-4" />
            Редактировать
          </Link>
          <Link
            href={`/${packageId}/export`}
            className="inline-flex items-center gap-2 btn-primary rounded-lg px-4 py-2.5 text-sm"
          >
            <Download className="h-4 w-4" />
            Экспорт
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-destructive px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
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
                  onClick={handleDelete}
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
      {tours.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">Туры</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTourId(null)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
      {filteredQuestions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">
            Вопросы ({filteredQuestions.length}
            {selectedTourId && questions.length > 0 ? ` из ${questions.length}` : ""})
          </h2>
          <VirtualizedQuestionList questions={filteredQuestions} />
        </div>
      )}

      {filteredQuestions.length === 0 && !isDecrypting && (
        <div className="text-center py-12 text-muted-foreground">
          <p>В этом пакете пока нет вопросов</p>
          <Link
            href={`/${packageId}/edit`}
            className="mt-4 inline-flex items-center gap-2 btn-outline rounded-lg px-4 py-2 text-sm"
          >
            <Edit className="h-4 w-4" />
            Добавить вопросы
          </Link>
        </div>
      )}
    </div>
  );
}
