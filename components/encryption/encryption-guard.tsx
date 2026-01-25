"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEncryptionStore } from "@/stores/encryption";

interface EncryptionGuardProps {
  children: ReactNode;
}

export function EncryptionGuard({ children }: EncryptionGuardProps) {
  const status = useEncryptionStore((s) => s.status);
  const error = useEncryptionStore((s) => s.error);

  // Show loading state
  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state
  if (status === "error") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Ошибка шифрования</h2>
            <p className="text-sm text-muted-foreground">
              {error || "Не удалось инициализировать шифрование"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Show children when ready
  return <>{children}</>;
}
