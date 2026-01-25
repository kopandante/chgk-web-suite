// Export to OpenQuiz JSON format

import type { Package, Question, Tour } from "@/lib/db/encrypted-client";

export interface OpenQuizExportOptions {
  includeComment?: boolean;
  includeSource?: boolean;
  includeAuthor?: boolean;
  includeHandout?: boolean;
}

const DEFAULT_OPTIONS: Required<OpenQuizExportOptions> = {
  includeComment: true,
  includeSource: true,
  includeAuthor: true,
  includeHandout: true,
};

// OpenQuiz question format
interface OpenQuizQuestion {
  question: string;
  answer: string;
  acceptableAnswers?: string[];
  comment?: string;
  source?: string;
  author?: string;
  handout?: string;
}

// OpenQuiz package format
interface OpenQuizPackage {
  title: string;
  author?: string;
  questions: OpenQuizQuestion[];
}

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

// Remove image placeholders from text
function stripImagePlaceholders(text: string): string {
  return text.replace(/\(img\s+[A-Za-z0-9_()-]+\.[a-z]+\)/gi, "").trim();
}

// Process text for OpenQuiz format
function processText(text: string): string {
  let result = stripFormatting(text);
  result = stripImagePlaceholders(result);
  return result.trim();
}

// Parse zachet field into array of acceptable answers
function parseAcceptableAnswers(zachet: string): string[] {
  const processed = processText(zachet);
  // Split by common separators: comma, semicolon, "или"
  const answers = processed
    .split(/[,;]|\s+или\s+/i)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
  return answers;
}

export function exportToOpenQuiz(
  pkg: Package,
  questions: Question[],
  tours: Tour[],
  userOptions: OpenQuizExportOptions = {},
): OpenQuizPackage {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  // Group questions by tour for correct ordering
  const tourMap = new Map<string | null, Question[]>();
  for (const q of questions) {
    const key = q.tour_id;
    if (!tourMap.has(key)) {
      tourMap.set(key, []);
    }
    tourMap.get(key)!.push(q);
  }

  // Collect all questions in tour order
  const orderedQuestions: Question[] = [];
  const toursToProcess = tours.length > 0 ? tours : [null];

  for (const tour of toursToProcess) {
    const tourId = tour?.id ?? null;
    const tourQuestions = tourMap.get(tourId) || [];
    orderedQuestions.push(...tourQuestions);
  }

  // Convert to OpenQuiz format
  const openQuizQuestions: OpenQuizQuestion[] = orderedQuestions.map((q) => {
    const result: OpenQuizQuestion = {
      question: processText(q.question),
      answer: q.answer ? processText(q.answer) : "",
    };

    // Parse acceptable answers from zachet field
    if (q.zachet) {
      const acceptableAnswers = parseAcceptableAnswers(q.zachet);
      if (acceptableAnswers.length > 0) {
        result.acceptableAnswers = acceptableAnswers;
      }
    }

    // Optional fields
    if (options.includeComment && q.comment) {
      result.comment = processText(q.comment);
    }

    if (options.includeSource && q.source) {
      result.source = processText(q.source);
    }

    if (options.includeAuthor && q.author) {
      result.author = processText(q.author);
    }

    if (options.includeHandout && q.handout) {
      result.handout = processText(q.handout);
    }

    return result;
  });

  // Build the package
  const result: OpenQuizPackage = {
    title: pkg.title,
    questions: openQuizQuestions,
  };

  if (pkg.editor) {
    result.author = pkg.editor;
  }

  return result;
}

// Export to JSON string
export function exportToOpenQuizJson(
  pkg: Package,
  questions: Question[],
  tours: Tour[],
  options: OpenQuizExportOptions = {},
): string {
  const data = exportToOpenQuiz(pkg, questions, tours, options);
  return JSON.stringify(data, null, 2);
}

// Download as JSON file
export function downloadOpenQuizFile(
  pkg: Package,
  questions: Question[],
  tours: Tour[],
  options: OpenQuizExportOptions = {},
  filename?: string,
): void {
  const json = exportToOpenQuizJson(pkg, questions, tours, options);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const name = filename || pkg.title.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s-]/g, "").trim();
  link.download = name.endsWith(".json") ? name : `${name}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
