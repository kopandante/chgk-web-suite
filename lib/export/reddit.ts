// Export to Reddit Markdown format
// Converts questions to Reddit-compatible markdown with spoiler tags

import {
  isStructuredField,
  type Package,
  type Question,
  type QuestionFieldValue,
  type Tour,
} from "@/lib/db/encrypted-client";

export interface RedditExportOptions {
  // Include fields
  includeZachet?: boolean;
  includeNezachet?: boolean;
  includeComment?: boolean;
  includeSource?: boolean;
  includeAuthor?: boolean;
  includeHandout?: boolean;
  // Use spoilers for answers
  useSpoilers?: boolean;
}

const DEFAULT_OPTIONS: Required<RedditExportOptions> = {
  includeZachet: true,
  includeNezachet: true,
  includeComment: true,
  includeSource: true,
  includeAuthor: true,
  includeHandout: true,
  useSpoilers: true,
};

/**
 * Convert internal formatting to Reddit Markdown
 * _italic_ -> *italic*
 * __bold__ -> **bold**
 * ___underline___ -> ***underline*** (Reddit doesn't have underline, use bold+italic)
 * ~strike~ -> ~~strike~~
 */
function toRedditMarkdown(text: string): string {
  // Remove image placeholders - Reddit handles images separately
  let result = text.replace(/\(img\s+[A-Za-z0-9_()-]+\.[a-z]+\)/gi, "");

  // Restore underscores from parser placeholder
  result = result.replace(/\$\$UNDERSCORE\$\$/g, "_");

  // Convert formatting markers to Reddit Markdown
  // Order matters: longer patterns first
  result = result.replace(/___(.+?)___/g, "***$1***"); // underline -> bold+italic
  result = result.replace(/__(.+?)__/g, "**$1**"); // bold
  result = result.replace(/_(.+?)_/g, "*$1*"); // italic
  result = result.replace(/~(.+?)~/g, "~~$1~~"); // strikethrough

  return result.trim();
}

/**
 * Wrap text in Reddit spoiler tags
 */
function wrapSpoiler(text: string): string {
  // Reddit spoiler syntax: >!text!<
  // Handle multiline by replacing newlines with space for spoiler
  const singleLine = text.replace(/\n/g, " ");
  return `>!${singleLine}!<`;
}

// Convert QuestionFieldValue to string for export
function fieldValueToString(value: QuestionFieldValue | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (isStructuredField(value)) {
    const parts: string[] = [];
    if (value.header) parts.push(value.header);
    value.items.forEach((item, idx) => {
      parts.push(`${idx + 1}. ${item}`);
    });
    return parts.join("\n");
  }
  return "";
}

// Convert source field to string
function sourceToString(source: string | string[] | null | undefined): string {
  if (!source) return "";
  if (typeof source === "string") return source;
  return source.join("\n");
}

/**
 * Format a single question for Reddit
 */
function formatQuestion(
  question: Question,
  index: number,
  options: Required<RedditExportOptions>,
): string {
  const parts: string[] = [];
  const questionNumber = question.number ?? index + 1;

  // Type label
  const typeLabel =
    question.type === "duplet" ? " (Дуплет)" : question.type === "blitz" ? " (Блиц)" : "";

  // Question header
  parts.push(`**Вопрос ${questionNumber}${typeLabel}**`);
  parts.push("");

  // Handout
  if (options.includeHandout && question.handout) {
    parts.push(`*Раздатка:* ${toRedditMarkdown(question.handout)}`);
    parts.push("");
  }

  // Question text
  const questionText = fieldValueToString(question.question);
  parts.push(toRedditMarkdown(questionText));
  parts.push("");

  // Answer section
  const answerText = fieldValueToString(question.answer);
  if (answerText) {
    const answerMarkdown = toRedditMarkdown(answerText);
    if (options.useSpoilers) {
      parts.push(`**Ответ:** ${wrapSpoiler(answerMarkdown)}`);
    } else {
      parts.push(`**Ответ:** ${answerMarkdown}`);
    }
  }

  // Zachet
  if (options.includeZachet && question.zachet) {
    const zachetText = toRedditMarkdown(question.zachet);
    if (options.useSpoilers) {
      parts.push(`**Зачет:** ${wrapSpoiler(zachetText)}`);
    } else {
      parts.push(`**Зачет:** ${zachetText}`);
    }
  }

  // Nezachet
  if (options.includeNezachet && question.nezachet) {
    const nezachetText = toRedditMarkdown(question.nezachet);
    if (options.useSpoilers) {
      parts.push(`**Незачет:** ${wrapSpoiler(nezachetText)}`);
    } else {
      parts.push(`**Незачет:** ${nezachetText}`);
    }
  }

  // Comment
  if (options.includeComment && question.comment) {
    const commentText = toRedditMarkdown(question.comment);
    if (options.useSpoilers) {
      parts.push(`**Комментарий:** ${wrapSpoiler(commentText)}`);
    } else {
      parts.push(`**Комментарий:** ${commentText}`);
    }
  }

  // Source
  const sourceStr = sourceToString(question.source);
  if (options.includeSource && sourceStr) {
    const sourceText = toRedditMarkdown(sourceStr);
    if (options.useSpoilers) {
      parts.push(`**Источник:** ${wrapSpoiler(sourceText)}`);
    } else {
      parts.push(`**Источник:** ${sourceText}`);
    }
  }

  // Author
  if (options.includeAuthor && question.author) {
    const authorText = toRedditMarkdown(question.author);
    parts.push(`**Автор:** ${authorText}`);
  }

  return parts.join("\n");
}

/**
 * Export package to Reddit Markdown format
 */
export function exportToReddit(
  pkg: Package,
  questions: Question[],
  tours: Tour[],
  userOptions: RedditExportOptions = {},
): string {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const lines: string[] = [];

  // Package title as H1
  lines.push(`# ${pkg.title}`);
  lines.push("");

  // Editor
  if (pkg.editor) {
    lines.push(`*Редактор: ${pkg.editor}*`);
    lines.push("");
  }

  // Date
  if (pkg.date) {
    lines.push(`*Дата: ${pkg.date}*`);
    lines.push("");
  }

  // Group questions by tour
  const tourMap = new Map<string | null, Question[]>();
  for (const q of questions) {
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
      lines.push(`## ${tour.title || `Тур ${tourIndex + 1}`}`);
      lines.push("");
      tourIndex++;
    }

    // Questions
    for (let i = 0; i < tourQuestions.length; i++) {
      const question = tourQuestions[i];

      // Add question
      lines.push(formatQuestion(question, i, options));
      lines.push("");

      // Add separator between questions (except after last)
      if (i < tourQuestions.length - 1) {
        lines.push("---");
        lines.push("");
      }
    }

    // Add separator between tours
    if (tour !== toursToProcess[toursToProcess.length - 1]) {
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Download Reddit Markdown as a text file
 */
export function downloadRedditFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy single question to clipboard in Reddit format
 */
export function copyQuestionAsReddit(
  question: Question,
  index: number,
  userOptions: RedditExportOptions = {},
): string {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  return formatQuestion(question, index, options);
}
