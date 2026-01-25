"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@/convex/_generated/api";
import { decrypt, encrypt } from "@/lib/crypto";
import { useEncryptionStore } from "@/stores/encryption";

export function useTrello() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const userId = user?.id;
  const masterKey = useEncryptionStore((state) => state.masterKey);

  // Оптимистичное состояние для немедленного отображения
  const [optimisticConnected, setOptimisticConnected] = useState<boolean | null>(null);

  // Получить зашифрованную интеграцию
  const integration = useQuery(
    api.integrations.getIntegration,
    userId ? { userId, type: "trello" } : "skip",
  );

  // Mutations
  const saveIntegrationMutation = useMutation(api.integrations.saveIntegration);
  const deleteIntegrationMutation = useMutation(api.integrations.deleteIntegration);

  // Расшифровать токен (если есть интеграция и ключ)
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!integration || !masterKey) return null;

    try {
      const decrypted = await decrypt<string>(masterKey, {
        ciphertext: integration.encryptedToken,
        iv: integration.iv,
      });
      return decrypted;
    } catch {
      return null;
    }
  }, [integration, masterKey]);

  // Сохранить токен (зашифрованный)
  const saveToken = useCallback(
    async (token: string) => {
      if (!userId || !masterKey) throw new Error("Not authenticated or encryption not ready");

      const { ciphertext, iv } = await encrypt(masterKey, token);
      setOptimisticConnected(true);
      await saveIntegrationMutation({
        userId,
        type: "trello",
        encryptedToken: ciphertext,
        iv,
      });
    },
    [userId, masterKey, saveIntegrationMutation],
  );

  // Удалить токен
  const deleteToken = useCallback(async () => {
    if (!userId) throw new Error("Not authenticated");
    setOptimisticConnected(false);
    await deleteIntegrationMutation({ userId, type: "trello" });
  }, [userId, deleteIntegrationMutation]);

  // Используем оптимистичное состояние пока Convex не обновится
  const isConnected = optimisticConnected ?? !!integration;

  return {
    isLoading: !isUserLoaded,
    isConnected,
    isReady: !!masterKey,
    getToken,
    saveToken,
    deleteToken,
  };
}
