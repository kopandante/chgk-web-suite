// Import Trello boards as CHGK packages
// This module now uses Convex for storage

import type { Id } from "@/convex/_generated/dataModel";
import {
  preparePackageCreate,
  prepareQuestionCreate,
  prepareTourCreate,
} from "@/lib/db/encrypted-client";
import { fetchBoardCards, fetchBoards, fetchLists, type TrelloBoard } from "./client";
import { type ParsedPackage, parseCardsToTours } from "./parser";

export interface TrelloImportOptions {
  token: string;
  boardId: string;
  // Use lists as tours
  listsAsTours: boolean;
}

export interface TrelloImportResult {
  packageId: Id<"packages">;
  questionCount: number;
  tourCount: number;
}

// Dependencies for Convex operations
export interface ConvexDependencies {
  masterKey: CryptoKey;
  createPackage: (args: { encryptedData: string; iv: string }) => Promise<Id<"packages">>;
  createTour: (args: {
    packageId: Id<"packages">;
    encryptedData: string;
    iv: string;
    orderNum: number;
  }) => Promise<Id<"tours">>;
  createQuestionsBulk: (args: {
    questions: Array<{
      packageId: Id<"packages">;
      tourId?: Id<"tours">;
      encryptedData: string;
      iv: string;
      orderNum: number;
    }>;
  }) => Promise<Id<"questions">[]>;
}

/**
 * Fetch and parse a Trello board
 */
export async function fetchTrelloPackage(token: string, boardId: string): Promise<ParsedPackage> {
  // Fetch board info
  const boards = await fetchBoards(token);
  const board = boards.find((b) => b.id === boardId);

  if (!board) {
    throw new Error("Board not found");
  }

  // Fetch lists and cards
  const [lists, cards] = await Promise.all([
    fetchLists(token, boardId),
    fetchBoardCards(token, boardId),
  ]);

  // Parse cards into tours
  const tours = parseCardsToTours(cards, lists);

  return {
    title: board.name,
    editor: null,
    date: new Date().toISOString().split("T")[0],
    tours,
  };
}

/**
 * Import a Trello board as a package
 */
export async function importTrelloBoard(
  options: TrelloImportOptions,
  deps: ConvexDependencies,
  onProgress?: (status: string) => void,
): Promise<TrelloImportResult> {
  onProgress?.("Загрузка доски...");

  // Fetch and parse board
  const parsed = await fetchTrelloPackage(options.token, options.boardId);

  onProgress?.("Создание пакета...");

  // Create encrypted package
  const packageData = await preparePackageCreate(deps.masterKey, {
    title: parsed.title,
    editor: parsed.editor || undefined,
    date: parsed.date || undefined,
  });

  const packageId = await deps.createPackage({
    encryptedData: packageData.encryptedData,
    iv: packageData.iv,
  });

  let questionCount = 0;
  let tourCount = 0;

  if (options.listsAsTours && parsed.tours.length > 1) {
    // Import with tours
    for (const tour of parsed.tours) {
      onProgress?.(`Импорт тура: ${tour.title}...`);

      const tourData = await prepareTourCreate(deps.masterKey, {
        title: tour.title,
      });

      const tourId = await deps.createTour({
        packageId,
        encryptedData: tourData.encryptedData,
        iv: tourData.iv,
        orderNum: tourCount,
      });
      tourCount++;

      // Prepare all questions for this tour
      const questionsToCreate: Array<{
        packageId: Id<"packages">;
        tourId: Id<"tours">;
        encryptedData: string;
        iv: string;
        orderNum: number;
      }> = [];

      for (let i = 0; i < tour.questions.length; i++) {
        const q = tour.questions[i];
        const questionData = await prepareQuestionCreate(deps.masterKey, {
          number: q.number ?? undefined,
          question: q.question,
          answer: q.answer ?? undefined,
          zachet: q.zachet ?? undefined,
          nezachet: q.nezachet ?? undefined,
          comment: q.comment ?? undefined,
          source: q.source ?? undefined,
          author: q.author ?? undefined,
          handout: q.handout ?? undefined,
        });

        questionsToCreate.push({
          packageId,
          tourId,
          encryptedData: questionData.encryptedData,
          iv: questionData.iv,
          orderNum: questionCount + i,
        });
      }

      // Create all questions for this tour in bulk
      if (questionsToCreate.length > 0) {
        await deps.createQuestionsBulk({ questions: questionsToCreate });
        questionCount += questionsToCreate.length;
      }
    }
  } else {
    // Import as flat list
    const allQuestions = parsed.tours.flatMap((t) => t.questions);

    onProgress?.(`Импорт ${allQuestions.length} вопросов...`);

    const questionsToCreate: Array<{
      packageId: Id<"packages">;
      tourId?: Id<"tours">;
      encryptedData: string;
      iv: string;
      orderNum: number;
    }> = [];

    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      const questionData = await prepareQuestionCreate(deps.masterKey, {
        number: q.number ?? i + 1,
        question: q.question,
        answer: q.answer ?? undefined,
        zachet: q.zachet ?? undefined,
        nezachet: q.nezachet ?? undefined,
        comment: q.comment ?? undefined,
        source: q.source ?? undefined,
        author: q.author ?? undefined,
        handout: q.handout ?? undefined,
      });

      questionsToCreate.push({
        packageId,
        encryptedData: questionData.encryptedData,
        iv: questionData.iv,
        orderNum: i,
      });
    }

    // Create all questions in bulk
    if (questionsToCreate.length > 0) {
      await deps.createQuestionsBulk({ questions: questionsToCreate });
      questionCount = questionsToCreate.length;
    }
  }

  return {
    packageId,
    questionCount,
    tourCount,
  };
}

/**
 * Get list of user's Trello boards
 */
export async function getTrelloBoards(token: string): Promise<TrelloBoard[]> {
  return fetchBoards(token);
}
