// Import Trello boards as CHGK packages

import { createPackage, createQuestion, createTour, saveDatabase } from "@/lib/db/client";
import { fetchBoardCards, fetchBoards, fetchLists, type TrelloBoard } from "./client";
import { type ParsedPackage, parseCardsToTours } from "./parser";

export interface TrelloImportOptions {
  boardId: string;
  // Use lists as tours
  listsAsTours: boolean;
}

export interface TrelloImportResult {
  packageId: string;
  questionCount: number;
  tourCount: number;
}

/**
 * Fetch and parse a Trello board
 */
export async function fetchTrelloPackage(boardId: string): Promise<ParsedPackage> {
  // Fetch board info
  const boards = await fetchBoards();
  const board = boards.find((b) => b.id === boardId);

  if (!board) {
    throw new Error("Board not found");
  }

  // Fetch lists and cards
  const [lists, cards] = await Promise.all([fetchLists(boardId), fetchBoardCards(boardId)]);

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
  onProgress?: (status: string) => void,
): Promise<TrelloImportResult> {
  onProgress?.("Загрузка доски...");

  // Fetch and parse board
  const parsed = await fetchTrelloPackage(options.boardId);

  onProgress?.("Создание пакета...");

  // Create package
  const pkg = await createPackage({
    title: parsed.title,
    editor: parsed.editor || undefined,
    date: parsed.date || undefined,
  });

  let questionCount = 0;
  let tourCount = 0;

  if (options.listsAsTours && parsed.tours.length > 1) {
    // Import with tours
    for (const tour of parsed.tours) {
      onProgress?.(`Импорт тура: ${tour.title}...`);

      const tourRecord = await createTour({
        package_id: pkg.id,
        title: tour.title,
        order_num: tourCount,
      });
      tourCount++;

      for (let i = 0; i < tour.questions.length; i++) {
        const q = tour.questions[i];
        await createQuestion({
          package_id: pkg.id,
          tour_id: tourRecord.id,
          order_num: questionCount,
          number: q.number,
          question: q.question,
          answer: q.answer,
          zachet: q.zachet,
          nezachet: q.nezachet,
          comment: q.comment,
          source: q.source,
          author: q.author,
          handout: q.handout,
        });
        questionCount++;
      }
    }
  } else {
    // Import as flat list
    const allQuestions = parsed.tours.flatMap((t) => t.questions);

    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      onProgress?.(`Импорт вопроса ${i + 1}/${allQuestions.length}...`);

      await createQuestion({
        package_id: pkg.id,
        tour_id: null,
        order_num: i,
        number: q.number ?? i + 1,
        question: q.question,
        answer: q.answer,
        zachet: q.zachet,
        nezachet: q.nezachet,
        comment: q.comment,
        source: q.source,
        author: q.author,
        handout: q.handout,
      });
      questionCount++;
    }
  }

  await saveDatabase();

  return {
    packageId: pkg.id,
    questionCount,
    tourCount,
  };
}

/**
 * Get list of user's Trello boards
 */
export async function getTrelloBoards(): Promise<TrelloBoard[]> {
  return fetchBoards();
}
