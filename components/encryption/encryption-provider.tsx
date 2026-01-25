"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, type ReactNode } from "react";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  exportKey,
  generateAesKey,
  importKey,
} from "@/lib/crypto";
import { useEncryptionStore } from "@/stores/encryption";

interface EncryptionProviderProps {
  children: ReactNode;
}

/**
 * Провайдер шифрования — инициализирует ключ один раз при загрузке пользователя.
 * Должен быть обёрнут вокруг всего приложения (внутри ClerkProvider).
 */
export function EncryptionProvider({ children }: EncryptionProviderProps) {
  const { user, isLoaded } = useUser();
  const initializedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (initializedForRef.current === user.id) return;

    const { setReady, setError, setLoading } = useEncryptionStore.getState();

    initializedForRef.current = user.id;
    setLoading();

    (async () => {
      try {
        const storedKey = user.unsafeMetadata?.encryptionKey as string | undefined;

        if (storedKey) {
          const keyData = base64ToArrayBuffer(storedKey);
          const key = await importKey(keyData);
          setReady(key);
        } else {
          const newKey = await generateAesKey();
          const exportedKey = await exportKey(newKey);
          const keyBase64 = arrayBufferToBase64(exportedKey);

          await user.update({
            unsafeMetadata: {
              ...user.unsafeMetadata,
              encryptionKey: keyBase64,
            },
          });

          setReady(newKey);
        }
      } catch (err) {
        initializedForRef.current = null;
        const message = err instanceof Error ? err.message : "Ошибка инициализации шифрования";
        setError(message);
      }
    })();
  }, [isLoaded, user?.id]);

  return <>{children}</>;
}
