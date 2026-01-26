"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery as useConvexQuery } from "convex/react";
import { Edit, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormatSource, FormatText } from "@/components/format-text";
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
    <div className="library-card p-4 space-y-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        Вопрос {question.number ?? index + 1}
      </div>
      {question.handout && (
        <div className="bg-secondary/50 rounded-md p-3 text-sm border-l-2 border-accent">
          <span className="text-muted-foreground">Раздатка: </span>
          <FormatText text={question.handout} questionId={question.id} />
        </div>
      )}
      <div className="whitespace-pre-wrap leading-relaxed">
        <FormatText text={question.question} questionId={question.id} />
      </div>
      {question.answer && (
        <div className="pt-3 border-t text-sm">
          <span className="text-muted-foreground">Ответ: </span>
          <span className="font-medium">
            <FormatText text={question.answer} questionId={question.id} />
          </span>
        </div>
      )}
      {question.zachet && (
        <div className="text-sm text-muted-foreground">
          <span>Зачет: </span>
          <FormatText text={question.zachet} questionId={question.id} />
        </div>
      )}
      {question.source && (
        <div className="text-sm text-muted-foreground">
          <span>Источник: </span>
          <FormatSource source={question.source} questionId={question.id} />
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

function VirtualizedQuestionList({ questions }: { questions: Question[] }) {
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
  const packageId = params.id as Id<"packages">;
  const masterKey = useEncryptionStore((state) => state.masterKey);

  const [pkg, setPkg] = useState<Package | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<Id<"tours"> | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(true);

  const encryptedPkg = useConvexQuery(api.packages.get, { id: packageId });
  const encryptedQuestions = useConvexQuery(api.questions.listByPackage, { packageId });
  const encryptedTours = useConvexQuery(api.tours.listByPackage, { packageId });

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

  useEffect(() => {
    if (!encryptedQuestions || !masterKey) {
      setQuestions([]);
      return;
    }

    decryptQuestions(masterKey, encryptedQuestions)
      .then((decrypted) => {
        const sorted = [...decrypted].sort((a, b) => a.order_num - b.order_num);
        setQuestions(sorted);
      })
      .catch((err) => {
        console.error("Failed to decrypt questions:", err);
        setQuestions([]);
      });
  }, [encryptedQuestions, masterKey]);

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

  const filteredQuestions = selectedTourId
    ? questions.filter((q) => q.tour_id === selectedTourId)
    : questions;

  if (encryptedPkg === undefined || isDecrypting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="mt-3 text-sm">Загрузка...</p>
      </div>
    );
  }

  if (!pkg) {
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
        <h1 className="text-xl font-semibold tracking-tight">{pkg.title}</h1>
        {pkg.editor && <p className="mt-1 text-sm text-muted-foreground">{pkg.editor}</p>}
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {pkg.question_count}{" "}
          {pkg.question_count === 1 ? "вопрос" : pkg.question_count < 5 ? "вопроса" : "вопросов"}
          {pkg.tour_count > 0 &&
            ` / ${pkg.tour_count} ${pkg.tour_count === 1 ? "тур" : pkg.tour_count < 5 ? "тура" : "туров"}`}
        </p>
      </div>

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
          <VirtualizedQuestionList key={selectedTourId ?? "all"} questions={filteredQuestions} />
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
