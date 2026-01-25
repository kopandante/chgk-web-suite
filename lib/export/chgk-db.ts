// Export to db.chgk.info text format

import type { Package, Question, Tour } from "@/lib/db/encrypted-client";
import { maybeShuffleQuestions, type RandomizeOptions } from "./utils";

export interface ChgkDbExportOptions extends RandomizeOptions {
  includeZachet?: boolean;
  includeNezachet?: boolean;
  includeComment?: boolean;
  includeSource?: boolean;
  includeAuthor?: boolean;
  includeHandout?: boolean;
}

const DEFAULT_OPTIONS: Omit<Required<ChgkDbExportOptions>, "randomizeSeed"> = {
  includeZachet: true,
  includeNezachet: true,
  includeComment: true,
  includeSource: true,
  includeAuthor: true,
  includeHandout: true,
  randomize: false,
};

// Remove formatting markers (_italic_, __bold__, etc.)
function stripFormatting(text: string): string {
  // Restore underscores from parser placeholder
  let result = text.replace(/\$\$UNDERSCORE\$\$/g, "_");
  // Remove formatting markers: ___, __, _, ~
  result = result.replace(/___(.+?)___/g, "$1");
  result = result.replace(/__(.+?)__/g, "$1");
  result = result.replace(/_(.+?)_/g, "$1");
  result = result.replace(/~(.+?)~/g, "$1");
  return result;
}

// Convert image placeholders to db.chgk.info format
function convertImagePlaceholders(text: string): string {
  // (img filename.ext) -> (pic: filename.ext)
  return text.replace(/\(img\s+([A-Za-z0-9_()-]+\.[a-z]+)\)/gi, "(pic: $1)");
}

// Format date to db.chgk.info format (1-Jan-2024)
function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  // Try to parse various date formats
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    // If parsing failed, return original
    return dateStr;
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

// Process text for db.chgk.info format
function processText(text: string): string {
  let result = stripFormatting(text);
  result = convertImagePlaceholders(result);
  return result.trim();
}

// Format handout with special tags
function formatHandout(handout: string): string {
  const processed = processText(handout);
  return `<раздатка>\n${processed}\n</раздатка>`;
}

export function exportToChgkDb(
  pkg: Package,
  questions: Question[],
  tours: Tour[],
  userOptions: ChgkDbExportOptions = {},
): string {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  // Apply randomization if enabled
  const processedQuestions = maybeShuffleQuestions(questions, userOptions);

  const lines: string[] = [];

  // Package header
  lines.push("Чемпионат:");
  lines.push(pkg.title);
  lines.push("");

  // Date
  const formattedDate = formatDate(pkg.date);
  if (formattedDate) {
    lines.push("Дата:");
    lines.push(formattedDate);
    lines.push("");
  }

  // Editor
  if (pkg.editor) {
    lines.push("Редактор:");
    lines.push(pkg.editor);
    lines.push("");
  }

  // Group questions by tour
  const tourMap = new Map<string | null, Question[]>();
  for (const q of processedQuestions) {
    const key = q.tour_id;
    if (!tourMap.has(key)) {
      tourMap.set(key, []);
    }
    tourMap.get(key)!.push(q);
  }

  // Process each tour
  let tourIndex = 0;
  const toursToProcess = tours.length > 0 ? tours : [null];

  for (const tour of toursToProcess) {
    const tourId = tour?.id ?? null;
    const tourQuestions = tourMap.get(tourId) || [];

    if (tourQuestions.length === 0) continue;

    // Tour header (only if we have multiple tours or tour has a title)
    if (tour && (tours.length > 1 || tour.title)) {
      lines.push("Тур:");
      lines.push(tour.title || `Тур ${tourIndex + 1}`);
      lines.push("");
      tourIndex++;
    }

    // Questions
    for (let i = 0; i < tourQuestions.length; i++) {
      const question = tourQuestions[i];
      const questionNumber = question.number ?? i + 1;

      // Question number and text
      lines.push(`Вопрос ${questionNumber}:`);

      // Handout before question text
      if (options.includeHandout && question.handout) {
        lines.push(formatHandout(question.handout));
      }

      lines.push(processText(question.question));
      lines.push("");

      // Answer
      if (question.answer) {
        lines.push("Ответ:");
        lines.push(processText(question.answer));
        lines.push("");
      }

      // Zachet
      if (options.includeZachet && question.zachet) {
        lines.push("Зачёт:");
        lines.push(processText(question.zachet));
        lines.push("");
      }

      // Nezachet
      if (options.includeNezachet && question.nezachet) {
        lines.push("Незачёт:");
        lines.push(processText(question.nezachet));
        lines.push("");
      }

      // Comment
      if (options.includeComment && question.comment) {
        lines.push("Комментарий:");
        lines.push(processText(question.comment));
        lines.push("");
      }

      // Source
      if (options.includeSource && question.source) {
        lines.push("Источник:");
        lines.push(processText(question.source));
        lines.push("");
      }

      // Author
      if (options.includeAuthor && question.author) {
        lines.push("Автор:");
        lines.push(processText(question.author));
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

// Download as text file
export function downloadChgkDbFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".txt") ? filename : `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
