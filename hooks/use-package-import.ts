"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  encryptImageBinary,
  preparePackageCreate,
  prepareQuestionCreate,
  prepareTourCreate,
  type QuestionFieldValue,
  type QuestionType,
  type StructuredField,
} from "@/lib/db/encrypted-client";
import type { DocxImage } from "@/lib/parser/docx";
import type { ConvexDependencies } from "@/lib/trello/import";
import { useEncryptionStore } from "@/stores/encryption";

interface ParsedQuestion {
  number?: number;
  question: string | unknown;
  answer?: string | unknown;
  zachet?: string;
  nezachet?: string;
  comment?: string;
  source?: string | string[];
  author?: string;
  handout?: string;
}

type ParsedStructure = Array<[string, unknown]>;

// Convert parser output to QuestionFieldValue (string or structured)
function convertParserField(value: unknown): QuestionFieldValue | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    // Check if it's a duplet/blitz format with nested array: [header, [item1, item2, ...]]
    if (
      value.length === 2 &&
      typeof value[0] === "string" &&
      Array.isArray(value[1]) &&
      value[1].every((item) => typeof item === "string")
    ) {
      const structured: StructuredField = {
        header: value[0],
        items: value[1] as string[],
      };
      return structured;
    }

    // Check if it's a plain array of strings (e.g., answers: ["First", "Second"])
    if (value.every((item) => typeof item === "string")) {
      if (value.length > 1) {
        const structured: StructuredField = {
          items: value as string[],
        };
        return structured;
      }
      return value.join("\n");
    }
  }

  // Fallback: convert to string
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// Convert source field (can be string or array)
function convertSourceField(value: unknown): string | string[] | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value as string[];
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// Detect question type from parsed data
function detectParsedQuestionType(question: QuestionFieldValue): QuestionType {
  if (typeof question === "string") {
    const lower = question.toLowerCase();
    if (lower.startsWith("дуплет") || lower.includes("\nдуплет")) return "duplet";
    if (lower.startsWith("блиц") || lower.includes("\nблиц")) return "blitz";
    return "regular";
  }

  // Structured field
  const header = question.header?.toLowerCase() || "";
  if (header.includes("дуплет")) return "duplet";
  if (header.includes("блиц")) return "blitz";
  if (question.items.length === 2) return "duplet";
  if (question.items.length >= 3) return "blitz";
  return "regular";
}

export function usePackageImport() {
  const masterKey = useEncryptionStore((state) => state.masterKey);

  const createPackage = useMutation(api.packages.create);
  const createTour = useMutation(api.tours.create);
  const createQuestionsBulk = useMutation(api.questions.createBulk);
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const createImage = useMutation(api.images.create);

  const importParsedPackage = useCallback(
    async (
      title: string,
      structure: ParsedStructure,
      images: DocxImage[] = [],
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
      // Store question data with their text for image matching
      const questionsWithText: Array<{
        orderNum: number;
        tourId?: Id<"tours">;
        text: string; // Combined text of all fields for image placeholder matching
      }> = [];
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

          currentTourId = tourId;
          tourOrder++;
        } else if (type === "Question" && typeof value === "object" && value !== null) {
          const q = value as ParsedQuestion;

          const questionField = convertParserField(q.question) ?? "";
          const answerField = convertParserField(q.answer) ?? undefined;
          const zachetStr = typeof q.zachet === "string" ? q.zachet : undefined;
          const nezachetStr = typeof q.nezachet === "string" ? q.nezachet : undefined;
          const commentStr = typeof q.comment === "string" ? q.comment : undefined;
          const sourceField = convertSourceField(q.source) ?? undefined;
          const authorStr = typeof q.author === "string" ? q.author : undefined;
          const handoutStr = typeof q.handout === "string" ? q.handout : undefined;

          // Detect question type
          const questionType = detectParsedQuestionType(questionField);

          const questionData = await prepareQuestionCreate(masterKey, {
            type: questionType,
            number:
              typeof q.number === "number"
                ? q.number
                : typeof q.number === "string"
                  ? Number.parseInt(q.number, 10) || undefined
                  : undefined,
            question: questionField,
            answer: answerField,
            zachet: zachetStr,
            nezachet: nezachetStr,
            comment: commentStr,
            source: sourceField,
            author: authorStr,
            handout: handoutStr,
          });

          // Helper to get text from field for image matching
          const getFieldText = (field: QuestionFieldValue | null | undefined): string => {
            if (!field) return "";
            if (typeof field === "string") return field;
            return [field.header || "", ...field.items].join(" ");
          };

          // Combine all text fields for image matching
          const combinedText = [
            getFieldText(questionField),
            getFieldText(answerField),
            zachetStr,
            nezachetStr,
            commentStr,
            Array.isArray(sourceField) ? sourceField.join(" ") : sourceField,
            authorStr,
            handoutStr,
          ]
            .filter(Boolean)
            .join(" ");

          questionsWithText.push({
            orderNum: questionOrder,
            tourId: currentTourId,
            text: combinedText,
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

      // Create all questions in bulk and get their IDs
      let questionIds: Id<"questions">[] = [];
      if (questionsToCreate.length > 0) {
        questionIds = await createQuestionsBulk({ questions: questionsToCreate });
      }

      // Upload images and link to questions
      if (images.length > 0 && questionIds.length > 0) {
        for (const image of images) {
          // Find which question contains this image placeholder
          // Image placeholders look like: (img prefix_001.png)
          const imageIdWithExt = `${image.id}.${image.extension}`;
          const placeholderPattern = new RegExp(
            `\\(img\\s+${image.id}\\.${image.extension}\\)`,
            "i",
          );

          let targetQuestionIdx = -1;
          for (let i = 0; i < questionsWithText.length; i++) {
            if (placeholderPattern.test(questionsWithText[i].text)) {
              targetQuestionIdx = i;
              break;
            }
          }

          if (targetQuestionIdx === -1) {
            console.warn(`Image ${imageIdWithExt} not found in any question text`);
            continue;
          }

          const targetQuestionId = questionIds[targetQuestionIdx];

          try {
            // Encrypt the image
            const { encryptedBlob, iv } = await encryptImageBinary(masterKey, image.data);

            // Get upload URL
            const uploadUrl = await generateUploadUrl();

            // Upload to Convex Storage
            const uploadResult = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": encryptedBlob.type },
              body: encryptedBlob,
            });

            if (!uploadResult.ok) {
              throw new Error(`Upload failed: ${uploadResult.statusText}`);
            }

            const { storageId } = await uploadResult.json();

            // Create image record with filename (without extension for lookup)
            await createImage({
              questionId: targetQuestionId,
              storageId,
              iv,
              contentType: image.contentType,
              filename: image.id, // Store ID without extension
            });
          } catch (err) {
            console.error(`Failed to upload image ${imageIdWithExt}:`, err);
          }
        }
      }

      return packageId;
    },
    [masterKey, createPackage, createTour, createQuestionsBulk, generateUploadUrl, createImage],
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
