import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SidebarState {
  isOpen: boolean;
  _hasHydrated: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: false,
      _hasHydrated: false,
      setOpen: (open) => set({ isOpen: open }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "sidebar-state",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ isOpen: state.isOpen }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
