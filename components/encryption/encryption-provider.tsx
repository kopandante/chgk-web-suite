"use client";

import { useUser } from "@clerk/nextjs";
import { type ReactNode, useEffect, useRef } from "react";
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
  const userRef = useRef(user);
  const initializedForRef = useRef<string | null>(null);

  // Keep userRef in sync
  userRef.current = user;

  useEffect(() => {
    const currentUser = userRef.current;
    if (!isLoaded || !currentUser) return;
    if (initializedForRef.current === currentUser.id) return;

    const { setReady, setError, setLoading } = useEncryptionStore.getState();

    initializedForRef.current = currentUser.id;
    setLoading();

    (async () => {
      try {
        const storedKey = currentUser.unsafeMetadata?.encryptionKey as string | undefined;

        if (storedKey) {
          const keyData = base64ToArrayBuffer(storedKey);
          const key = await importKey(keyData);
          setReady(key);
        } else {
          const newKey = await generateAesKey();
          const exportedKey = await exportKey(newKey);
          const keyBase64 = arrayBufferToBase64(exportedKey);

          await currentUser.update({
            unsafeMetadata: {
              ...currentUser.unsafeMetadata,
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
  }, [isLoaded]);

  return <>{children}</>;
}
