import { create } from "zustand";
import type { Id } from "@/convex/_generated/dataModel";
import type { Package, Question, Tour } from "@/lib/db/encrypted-client";

interface PackageState {
  packageId: Id<"packages"> | null;
  pkg: Package | null;
  tours: Tour[];
  questions: Question[];
  isLoading: boolean;

  setPackage: (
    packageId: Id<"packages">,
    pkg: Package,
    tours: Tour[],
    questions: Question[],
  ) => void;
  setLoading: (isLoading: boolean) => void;
  updateQuestion: (questionId: Id<"questions">, data: Partial<Question>) => void;
  getQuestion: (questionId: Id<"questions">) => Question | undefined;
  clear: () => void;
}

export const usePackageStore = create<PackageState>((set, get) => ({
  packageId: null,
  pkg: null,
  tours: [],
  questions: [],
  isLoading: false,

  setPackage: (packageId, pkg, tours, questions) => {
    set({ packageId, pkg, tours, questions, isLoading: false });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  updateQuestion: (questionId, data) => {
    set((state) => ({
      questions: state.questions.map((q) => (q.id === questionId ? { ...q, ...data } : q)),
    }));
  },

  getQuestion: (questionId) => {
    return get().questions.find((q) => q.id === questionId);
  },

  clear: () => {
    set({ packageId: null, pkg: null, tours: [], questions: [], isLoading: false });
  },
}));
