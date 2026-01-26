"use client";

import { useQuery } from "convex/react";
import { ArrowRight, Calendar, FileText, Loader2, Plus, Upload } from "lucide-react";
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Пакеты</h1>
          <p className="text-sm text-muted-foreground">
            {packages.length > 0
              ? `${packages.length} ${packages.length === 1 ? "пакет" : packages.length < 5 ? "пакета" : "пакетов"}`
              : "Нет пакетов"}
          </p>
        </div>
        <Link
          href="/new"
          className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Новый
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm">Загрузка...</p>
        </div>
      ) : !packages || packages.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mx-auto">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-5 font-medium">Нет пакетов</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте новый или импортируйте из файла
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <Link
              href="/new"
              className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Создать
            </Link>
            <Link
              href="/new"
              className="btn-outline px-4 py-2 text-sm inline-flex items-center gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Импорт
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map((pkg, index) => (
            <Link
              key={pkg.id}
              href={`/${pkg.id}`}
              className="group flex items-center gap-4 p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {pkg.title}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {pkg.question_count}{" "}
                    {pkg.question_count === 1
                      ? "вопрос"
                      : pkg.question_count < 5
                        ? "вопроса"
                        : "вопросов"}
                  </span>
                  {pkg.tour_count > 0 && (
                    <span className="tabular-nums">
                      {pkg.tour_count}{" "}
                      {pkg.tour_count === 1 ? "тур" : pkg.tour_count < 5 ? "тура" : "туров"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(pkg.updated_at).toLocaleDateString("ru", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
