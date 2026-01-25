"use client";

import { useQuery } from "convex/react";
import { FileText, Loader2, Plus } from "lucide-react";
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
      .finally(() => setIsDecrypting(false));
  }, [encryptedPackages, masterKey]);

  const isLoading = encryptedPackages === undefined || isDecrypting;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои пакеты</h1>
        <Link
          href="/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Новый пакет
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка...
        </div>
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
              href={`/${pkg.id}`}
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
