"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { getAllPackages } from "@/lib/db/client";

export default function PackagesPage() {
  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: getAllPackages,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои пакеты</h1>
        <Link
          href="/packages/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Новый пакет
        </Link>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : !packages || packages.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Пока нет пакетов</p>
          <p className="text-sm mt-1">Создайте новый пакет или импортируйте из DOCX</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/packages/${pkg.id}`}
              className="block rounded-lg border bg-card p-6 hover:border-primary transition-colors"
            >
              <div className="font-medium">{pkg.title}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {pkg.tour_count > 0 ? `${pkg.tour_count} туров, ` : ""}
                {pkg.question_count} вопросов
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {new Date(pkg.updated_at).toLocaleDateString("ru")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
