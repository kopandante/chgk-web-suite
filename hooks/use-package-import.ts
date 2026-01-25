"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  preparePackageCreate,
  prepareQuestionCreate,
  prepareTourCreate,
} from "@/lib/db/encrypted-client";
import type { DocxImage } from "@/lib/parser/docx";
import type { ConvexDependencies } from "@/lib/trello/import";
import { useEncryptionStore } from "@/stores/encryption";

interface ParsedQuestion {
  number?: number;
  question: string;
  answer?: string;
  zachet?: string;
  nezachet?: string;
  comment?: string;
  source?: string;
  author?: string;
  handout?: string;
}

type ParsedStructure = Array<[string, unknown]>;

function stringifyField(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("\n");
  }
  return JSON.stringify(value);
}

export function usePackageImport() {
  const masterKey = useEncryptionStore((state) => state.masterKey);

  const createPackage = useMutation(api.packages.create);
  const createTour = useMutation(api.tours.create);
  const createQuestionsBulk = useMutation(api.questions.createBulk);

  const importParsedPackage = useCallback(
    async (
      title: string,
      structure: ParsedStructure,
      _images: DocxImage[] = [],
    ): Promise<Id<"packages">> => {
      if (!masterKey) {
        throw new Error("Encryption not ready");
      }

      // Extract metadata from structure
      let editor: string | null = null;
      let date: string | null = null;

      for (const [type, value] of structure) {
        if (type === "editor" && typeof value === "string") {
          editor = value;
        } else if (type === "date" && typeof value === "string") {
          date = value;
        }
      }

      // Create encrypted package
      const packageData = await preparePackageCreate(masterKey, {
        title,
        editor: editor ?? undefined,
        date: date ?? undefined,
      });

      const packageId = await createPackage({
        encryptedData: packageData.encryptedData,
        iv: packageData.iv,
      });

      // Process tours and questions
      const tours: Array<{ id: Id<"tours">; orderNum: number }> = [];
      const questionsToCreate: Array<{
        packageId: Id<"packages">;
        tourId?: Id<"tours">;
        encryptedData: string;
        iv: string;
        orderNum: number;
      }> = [];

      let currentTourId: Id<"tours"> | undefined;
      let questionOrder = 0;
      let tourOrder = 0;

      for (const [type, value] of structure) {
        if (type === "tour" || type === "tourrev") {
          const tourTitle = typeof value === "string" ? value : null;
          const tourData = await prepareTourCreate(masterKey, {
            title: tourTitle ?? undefined,
          });

          const tourId = await createTour({
            packageId,
            encryptedData: tourData.encryptedData,
            iv: tourData.iv,
            orderNum: tourOrder,
          });

          tours.push({ id: tourId, orderNum: tourOrder });
          currentTourId = tourId;
          tourOrder++;
        } else if (type === "Question" && typeof value === "object" && value !== null) {
          const q = value as ParsedQuestion;

          const questionData = await prepareQuestionCreate(masterKey, {
            number:
              typeof q.number === "number"
                ? q.number
                : typeof q.number === "string"
                  ? Number.parseInt(q.number, 10) || undefined
                  : undefined,
            question: stringifyField(q.question) ?? "",
            answer: stringifyField(q.answer) ?? undefined,
            zachet: stringifyField(q.zachet) ?? undefined,
            nezachet: stringifyField(q.nezachet) ?? undefined,
            comment: stringifyField(q.comment) ?? undefined,
            source: stringifyField(q.source) ?? undefined,
            author: stringifyField(q.author) ?? undefined,
            handout: stringifyField(q.handout) ?? undefined,
          });

          questionsToCreate.push({
            packageId,
            tourId: currentTourId,
            encryptedData: questionData.encryptedData,
            iv: questionData.iv,
            orderNum: questionOrder,
          });

          questionOrder++;
        }
      }

      // Create all questions in bulk
      if (questionsToCreate.length > 0) {
        await createQuestionsBulk({ questions: questionsToCreate });
      }

      return packageId;
    },
    [masterKey, createPackage, createTour, createQuestionsBulk],
  );

  const createEmptyPackage = useCallback(
    async (title: string): Promise<Id<"packages">> => {
      if (!masterKey) {
        throw new Error("Encryption not ready");
      }

      const packageData = await preparePackageCreate(masterKey, { title });
      return createPackage({
        encryptedData: packageData.encryptedData,
        iv: packageData.iv,
      });
    },
    [masterKey, createPackage],
  );

  const getConvexDeps = useCallback((): ConvexDependencies | null => {
    if (!masterKey) return null;
    return {
      masterKey,
      createPackage,
      createTour,
      createQuestionsBulk,
    };
  }, [masterKey, createPackage, createTour, createQuestionsBulk]);

  return {
    importParsedPackage,
    createEmptyPackage,
    getConvexDeps,
    isReady: !!masterKey,
  };
}
