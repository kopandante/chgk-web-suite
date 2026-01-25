// Telegram export using Bot API
// Converts questions to Telegram HTML format with spoilers

import type { Question } from "@/lib/db/schema";
import { maybeShuffleQuestions, type RandomizeOptions } from "./utils";

export interface TelegramExportOptions extends RandomizeOptions {
  // Channel ID or @username
  channelId: string;
  // Use spoilers for answers
  useSpoilers?: boolean;
  // Include fields
  includeZachet?: boolean;
  includeComment?: boolean;
  includeSource?: boolean;
  includeAuthor?: boolean;
  includeHandout?: boolean;
  // Delay between posts in ms
  postDelay?: number;
}

const DEFAULT_OPTIONS = {
  useSpoilers: true,
  includeZachet: true,
  includeComment: true,
  includeSource: true,
  includeAuthor: true,
  includeHandout: true,
  postDelay: 3000,
};

/**
 * Convert internal formatting to Telegram HTML
 * _italic_ -> <i>italic</i>
 * __bold__ -> <b>bold</b>
 * ___underline___ -> <u>underline</u>
 * ~strike~ -> <s>strike</s>
 */
export function toTelegramHtml(text: string): string {
  // Remove image placeholders - Telegram handles images separately
  let result = text.replace(/\(img\s+[A-Za-z0-9_()-]+\.[a-z]+\)/gi, "");

  // Restore escaped underscores first
  result = result.replace(/\\_/g, "_");

  // Convert formatting markers to HTML tags
  // Order matters: longer patterns first
  result = result.replace(/___(.+?)___/g, "<u>$1</u>");
  result = result.replace(/__(.+?)__/g, "<b>$1</b>");
  result = result.replace(/_(.+?)_/g, "<i>$1</i>");
  result = result.replace(/~(.+?)~/g, "<s>$1</s>");

  // Escape HTML special chars that aren't our tags
  // But preserve our formatting tags
  const tags = ["b", "i", "u", "s", "tg-spoiler", "a", "code", "pre"];
  const tagPattern = tags.join("|");

  // Split by tags, escape content, rejoin
  const parts = result.split(new RegExp(`(</?(?:${tagPattern})(?:\\s[^>]*)?>)`, "gi"));
  result = parts
    .map((part, i) => {
      // Odd indices are tags, even are content
      if (i % 2 === 1) return part;
      return escapeHtml(part);
    })
    .join("");

  return result.trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Format a single question for Telegram
 */
export function formatQuestionForTelegram(
  question: Question,
  index: number,
  options: Partial<TelegramExportOptions> = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [];
  const questionNumber = question.number ?? index + 1;

  // Question header
  parts.push(`<b>Вопрос ${questionNumber}</b>`);
  parts.push("");

  // Handout
  if (opts.includeHandout && question.handout) {
    parts.push(`<i>Раздатка:</i> ${toTelegramHtml(question.handout)}`);
    parts.push("");
  }

  // Question text
  parts.push(toTelegramHtml(question.question));
  parts.push("");

  // Answer section
  if (question.answer) {
    const answerText = toTelegramHtml(question.answer);
    if (opts.useSpoilers) {
      parts.push(`<b>Ответ:</b> <tg-spoiler>${answerText}</tg-spoiler>`);
    } else {
      parts.push(`<b>Ответ:</b> ${answerText}`);
    }
  }

  // Zachet
  if (opts.includeZachet && question.zachet) {
    const zachetText = toTelegramHtml(question.zachet);
    if (opts.useSpoilers) {
      parts.push(`<i>Зачёт:</i> <tg-spoiler>${zachetText}</tg-spoiler>`);
    } else {
      parts.push(`<i>Зачёт:</i> ${zachetText}`);
    }
  }

  // Comment
  if (opts.includeComment && question.comment) {
    const commentText = toTelegramHtml(question.comment);
    if (opts.useSpoilers) {
      parts.push(`<i>Комментарий:</i> <tg-spoiler>${commentText}</tg-spoiler>`);
    } else {
      parts.push(`<i>Комментарий:</i> ${commentText}`);
    }
  }

  // Source
  if (opts.includeSource && question.source) {
    const sourceText = toTelegramHtml(question.source);
    if (opts.useSpoilers) {
      parts.push(`<i>Источник:</i> <tg-spoiler>${sourceText}</tg-spoiler>`);
    } else {
      parts.push(`<i>Источник:</i> ${sourceText}`);
    }
  }

  // Author
  if (opts.includeAuthor && question.author) {
    const authorText = toTelegramHtml(question.author);
    parts.push(`<i>Автор:</i> ${authorText}`);
  }

  return parts.join("\n");
}

/**
 * Send a message to Telegram channel via API route
 */
export async function sendToTelegram(
  channelId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const response = await fetch("/api/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelId, text }),
    });

    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Test bot connection via API route
 */
export async function testBotConnection(): Promise<{
  ok: boolean;
  botName?: string;
  error?: string;
}> {
  try {
    const response = await fetch("/api/telegram");
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Export questions to Telegram channel
 * Stops on first error
 */
export async function exportToTelegram(
  questions: Question[],
  options: TelegramExportOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<{ success: number; failed: number; errors: string[]; stopped: boolean }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  let success = 0;
  let stopped = false;

  // Apply randomization if enabled
  const processedQuestions = maybeShuffleQuestions(questions, options);

  for (let i = 0; i < processedQuestions.length; i++) {
    const question = processedQuestions[i];
    const text = formatQuestionForTelegram(question, i, opts);

    const result = await sendToTelegram(opts.channelId, text);

    if (result.ok) {
      success++;
    } else {
      errors.push(`Вопрос ${question.number ?? i + 1}: ${result.error}`);
      stopped = true;
      onProgress?.(i + 1, processedQuestions.length);
      break; // Останавливаемся при первой ошибке
    }

    onProgress?.(i + 1, processedQuestions.length);

    // Delay between posts to avoid rate limiting
    if (i < processedQuestions.length - 1 && opts.postDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, opts.postDelay));
    }
  }

  return { success, failed: stopped ? 1 : 0, errors, stopped };
}

/**
 * Copy formatted question to clipboard (for manual posting)
 */
export function copyQuestionAsHtml(question: Question, index: number): string {
  return formatQuestionForTelegram(question, index, {
    useSpoilers: true,
    includeZachet: true,
    includeComment: true,
    includeSource: true,
    includeAuthor: true,
    includeHandout: true,
  });
}
