import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SidebarState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

// Check localStorage synchronously to get initial value
function getInitialOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem("sidebar-state");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.isOpen ?? true;
    }
  } catch {
    // Ignore errors
  }
  return true;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: getInitialOpen(),
      setOpen: (open) => set({ isOpen: open }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    }),
    {
      name: "sidebar-state",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
