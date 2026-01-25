// Parser for converting Trello cards to CHGK questions

import type { TrelloCard, TrelloList } from "./client";

export interface ParsedQuestion {
  number: number | null;
  question: string;
  answer: string | null;
  zachet: string | null;
  nezachet: string | null;
  comment: string | null;
  source: string | null;
  author: string | null;
  handout: string | null;
}

export interface ParsedTour {
  title: string;
  questions: ParsedQuestion[];
}

export interface ParsedPackage {
  title: string;
  editor: string | null;
  date: string | null;
  tours: ParsedTour[];
}

/**
 * Parse card description to extract question fields
 * Supports multiple formats:
 * - Labeled: "Ответ: ..." or "**Ответ:** ..."
 * - Simple: First line = question, second line = answer
 */
function parseCardDescription(desc: string): Partial<ParsedQuestion> {
  if (!desc.trim()) {
    return {};
  }

  const result: Partial<ParsedQuestion> = {};

  // Patterns for labeled fields (Russian and English)
  // Lookahead includes both Russian and English field names
  const nextField =
    "(?:Зач[её]т|Accept|Незач|Reject|Комм|Comment|Источ|Source|Автор|Author|Разд|Handout)";

  const patterns: Array<{
    field: keyof ParsedQuestion;
    patterns: RegExp[];
  }> = [
    {
      field: "answer",
      patterns: [
        new RegExp(
          `(?:^|\\n)\\s*(?:\\*\\*)?(?:Ответ|Answer|О)[:.;]?\\s*(?:\\*\\*)?\\s*(.+?)(?=\\n(?:\\*\\*)?${nextField}|$)`,
          "is",
        ),
      ],
    },
    {
      field: "zachet",
      patterns: [
        new RegExp(
          `(?:^|\\n)\\s*(?:\\*\\*)?(?:Зач[её]т|Accept)[:.;]?\\s*(?:\\*\\*)?\\s*(.+?)(?=\\n(?:\\*\\*)?(?:Незач|Reject|Комм|Comment|Источ|Source|Автор|Author|Разд|Handout)|$)`,
          "is",
        ),
      ],
    },
    {
      field: "nezachet",
      patterns: [
        new RegExp(
          `(?:^|\\n)\\s*(?:\\*\\*)?(?:Незач[её]т|Reject)[:.;]?\\s*(?:\\*\\*)?\\s*(.+?)(?=\\n(?:\\*\\*)?(?:Комм|Comment|Источ|Source|Автор|Author|Разд|Handout)|$)`,
          "is",
        ),
      ],
    },
    {
      field: "comment",
      patterns: [
        new RegExp(
          `(?:^|\\n)\\s*(?:\\*\\*)?(?:Комментарий|Comment|Комм)[:.;]?\\s*(?:\\*\\*)?\\s*(.+?)(?=\\n(?:\\*\\*)?(?:Источ|Source|Автор|Author|Разд|Handout)|$)`,
          "is",
        ),
      ],
    },
    {
      field: "source",
      patterns: [
        new RegExp(
          `(?:^|\\n)\\s*(?:\\*\\*)?(?:Источник|Source|Ист)[:.;]?\\s*(?:\\*\\*)?\\s*(.+?)(?=\\n(?:\\*\\*)?(?:Автор|Author|Разд|Handout)|$)`,
          "is",
        ),
      ],
    },
    {
      field: "author",
      patterns: [
        new RegExp(
          `(?:^|\\n)\\s*(?:\\*\\*)?(?:Автор|Author|Авт)[:.;]?\\s*(?:\\*\\*)?\\s*(.+?)(?=\\n(?:\\*\\*)?(?:Разд|Handout)|$)`,
          "is",
        ),
      ],
    },
    {
      field: "handout",
      patterns: [
        /(?:^|\n)\s*(?:\*\*)?(?:Раздатка|Раздаточный|Handout|Разд)[:.;]?\s*(?:\*\*)?\s*(.+?)$/is,
      ],
    },
  ];

  for (const { field, patterns: fieldPatterns } of patterns) {
    for (const pattern of fieldPatterns) {
      const match = desc.match(pattern);
      if (match) {
        result[field] = match[1].trim();
        break;
      }
    }
  }

  return result;
}

/**
 * Parse card name to extract question number
 * Formats: "1. Question", "Q1: Question", "Вопрос 1: Question", "#1 Question"
 */
function parseCardName(name: string): { number: number | null; question: string } {
  // Try various number prefixes
  const patterns = [
    /^(?:Вопрос\s*)?#?(\d+)[.:\s]\s*(.+)$/i,
    /^Q(\d+)[.:\s]\s*(.+)$/i,
    /^(\d+)[.)]\s*(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return {
        number: parseInt(match[1], 10),
        question: match[2].trim(),
      };
    }
  }

  return { number: null, question: name.trim() };
}

/**
 * Parse a single Trello card into a question
 */
export function parseCard(card: TrelloCard, index: number): ParsedQuestion {
  const { number, question } = parseCardName(card.name);
  const descFields = parseCardDescription(card.desc);

  return {
    number: number ?? index + 1,
    question,
    answer: descFields.answer ?? null,
    zachet: descFields.zachet ?? null,
    nezachet: descFields.nezachet ?? null,
    comment: descFields.comment ?? null,
    source: descFields.source ?? null,
    author: descFields.author ?? null,
    handout: descFields.handout ?? null,
  };
}

/**
 * Parse cards grouped by lists into tours
 */
export function parseCardsToTours(cards: TrelloCard[], lists: TrelloList[]): ParsedTour[] {
  // Sort lists by position
  const sortedLists = [...lists].sort((a, b) => a.pos - b.pos);

  // Group cards by list
  const cardsByList = new Map<string, TrelloCard[]>();
  for (const card of cards) {
    const listCards = cardsByList.get(card.idList) || [];
    listCards.push(card);
    cardsByList.set(card.idList, listCards);
  }

  // Create tours
  const tours: ParsedTour[] = [];
  for (const list of sortedLists) {
    const listCards = cardsByList.get(list.id) || [];
    if (listCards.length === 0) continue;

    // Sort cards by position
    const sortedCards = [...listCards].sort((a, b) => a.pos - b.pos);

    tours.push({
      title: list.name,
      questions: sortedCards.map((card, idx) => parseCard(card, idx)),
    });
  }

  return tours;
}

/**
 * Parse all cards as flat list (single tour)
 */
export function parseCardsFlat(cards: TrelloCard[]): ParsedQuestion[] {
  const sortedCards = [...cards].sort((a, b) => a.pos - b.pos);
  return sortedCards.map((card, idx) => parseCard(card, idx));
}
