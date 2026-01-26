import type { ReactNode } from "react";
import { create } from "zustand";

interface HeaderActionsState {
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
}

export const useHeaderActionsStore = create<HeaderActionsState>()((set) => ({
  actions: null,
  setActions: (actions) => set({ actions }),
}));
