"use client";

import { useEncryptionStore } from "@/stores/encryption";

/**
 * Хук для доступа к состоянию шифрования.
 * Просто читает из store — вся логика инициализации в EncryptionProvider.
 */
export function useEncryption() {
  const status = useEncryptionStore((s) => s.status);
  const masterKey = useEncryptionStore((s) => s.masterKey);
  const error = useEncryptionStore((s) => s.error);

  return {
    status,
    masterKey,
    error,
    isLoading: status === "loading",
    isReady: status === "ready",
  };
}
