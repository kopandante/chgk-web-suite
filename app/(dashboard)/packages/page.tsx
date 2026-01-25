"use client";

import { useQuery } from "convex/react";
import { ArrowRight, BookOpen, Calendar, FileText, Loader2, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { decryptPackages, type Package } from "@/lib/db/encrypted-client";
import { useEncryptionStore } from "@/stores/encryption";

export default function PackagesPage() {
  const masterKey = useEncryptionStore((state) => state.masterKey);
  const encryptedPackages = useQuery(api.packages.list);
  const [packages, setPackages] = useState<Package[]>([]);
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    if (!encryptedPackages || !masterKey) {
      setPackages([]);
      return;
    }

    setIsDecrypting(true);
    decryptPackages(masterKey, encryptedPackages)
      .then(setPackages)
      .catch((err) => {
        console.error("[PackagesPage] decrypt error:", err);
        setPackages([]);
      })
      .finally(() => setIsDecrypting(false));
  }, [encryptedPackages, masterKey]);

  const isLoading = encryptedPackages === undefined || isDecrypting;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Мои пакеты</h1>
          <p className="mt-2 text-muted-foreground">
            {packages.length > 0
              ? `${packages.length} ${packages.length === 1 ? "пакет" : packages.length < 5 ? "пакета" : "пакетов"}`
              : "Создайте первый пакет"}
          </p>
        </div>
        <Link
          href="/new"
          className="btn-gold rounded-lg px-5 py-3 text-sm inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Новый пакет
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <p className="mt-4 font-medium">Загрузка пакетов...</p>
          <p className="text-sm">Расшифровка данных</p>
        </div>
      ) : !packages || packages.length === 0 ? (
        <div className="text-center py-20">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
            <div className="relative w-24 h-24 rounded-2xl bg-card border flex items-center justify-center mx-auto">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
            </div>
          </div>
          <h2 className="mt-8 text-xl font-display font-semibold">Пока нет пакетов</h2>
          <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
            Создайте новый пакет вручную или импортируйте из DOCX файла или Trello
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/new"
              className="btn-primary rounded-lg px-6 py-3 text-sm inline-flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Создать пакет
            </Link>
            <Link
              href="/new"
              className="btn-outline rounded-lg px-6 py-3 text-sm inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Импортировать
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, index) => (
            <Link
              key={pkg.id}
              href={`/${pkg.id}`}
              className="group card-elevated p-6 animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground/0 group-hover:text-muted-foreground transition-all group-hover:translate-x-1" />
              </div>

              <div className="mt-4">
                <h3 className="font-display font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {pkg.title}
                </h3>

                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  {pkg.tour_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="font-medium text-foreground">{pkg.tour_count}</span>
                      {pkg.tour_count === 1 ? "тур" : pkg.tour_count < 5 ? "тура" : "туров"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium text-foreground">{pkg.question_count}</span>
                    {pkg.question_count === 1
                      ? "вопрос"
                      : pkg.question_count < 5
                        ? "вопроса"
                        : "вопросов"}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Обновлен{" "}
                  {new Date(pkg.updated_at).toLocaleDateString("ru", {
                    day: "numeric",
                    month: "short",
                    year:
                      pkg.updated_at < Date.now() - 365 * 24 * 60 * 60 * 1000
                        ? "numeric"
                        : undefined,
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
