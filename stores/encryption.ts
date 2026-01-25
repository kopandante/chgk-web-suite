import { create } from "zustand";

export type EncryptionStatus = "loading" | "ready" | "error";

interface EncryptionState {
  status: EncryptionStatus;
  masterKey: CryptoKey | null;
  error: string | null;

  // Actions
  setReady: (key: CryptoKey) => void;
  setError: (error: string) => void;
  setLoading: () => void;
  reset: () => void;
}

export const useEncryptionStore = create<EncryptionState>()((set) => ({
  status: "loading",
  masterKey: null,
  error: null,

  setReady: (key) =>
    set({
      status: "ready",
      masterKey: key,
      error: null,
    }),

  setError: (error) =>
    set({
      status: "error",
      masterKey: null,
      error,
    }),

  setLoading: () =>
    set({
      status: "loading",
      masterKey: null,
      error: null,
    }),

  reset: () =>
    set({
      status: "loading",
      masterKey: null,
      error: null,
    }),
}));
