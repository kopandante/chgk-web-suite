import { describe, expect, it } from "bun:test";
import { formatQuestionForTelegram, toTelegramHtml } from "@/lib/export/telegram";
import type { Question } from "@/lib/db/encrypted-client";
import type { Id } from "@/convex/_generated/dataModel";

describe("Telegram HTML conversion", () => {
  it("converts italic markers to HTML", () => {
    expect(toTelegramHtml("это _курсив_ текст")).toBe("это <i>курсив</i> текст");
  });

  it("converts bold markers to HTML", () => {
    expect(toTelegramHtml("это __жирный__ текст")).toBe("это <b>жирный</b> текст");
  });

  it("converts underline markers to HTML", () => {
    expect(toTelegramHtml("это ___подчеркнутый___ текст")).toBe(
      "это <u>подчеркнутый</u> текст",
    );
  });

  it("converts strike markers to HTML", () => {
    expect(toTelegramHtml("это ~зачеркнутый~ текст")).toBe("это <s>зачеркнутый</s> текст");
  });

  it("handles multiple formatting in one text", () => {
    expect(toTelegramHtml("_курсив_ и __жирный__")).toBe("<i>курсив</i> и <b>жирный</b>");
  });

  it("escapes HTML special characters", () => {
    expect(toTelegramHtml("a < b > c & d")).toBe("a &lt; b &gt; c &amp; d");
  });

  it("removes image placeholders", () => {
    expect(toTelegramHtml("текст (img test_001.png) еще текст")).toBe("текст  еще текст");
  });

  it("restores escaped underscores", () => {
    expect(toTelegramHtml("переменная\\_имя")).toBe("переменная_имя");
  });
});

describe("Question formatting for Telegram", () => {
  const mockQuestion: Question = {
    id: "test-1" as Id<"questions">,
    package_id: "pkg-1" as Id<"packages">,
    tour_id: null,
    order_num: 0,
    number: 1,
    question: "Назовите _этого_ __человека__.",
    answer: "Пушкин",
    zachet: "А.С. Пушкин",
    nezachet: null,
    comment: "Известный поэт",
    source: "https://example.com",
    author: "Автор Вопроса",
    handout: null,
    type: "regular",
    handoutType: "none",
    handoutImageId: null,
    created_at: Date.now(),
  };

  it("formats question with spoilers", () => {
    const result = formatQuestionForTelegram(mockQuestion, 0, { useSpoilers: true });
    expect(result).toContain("<b>Вопрос 1</b>");
    expect(result).toContain("<i>этого</i>");
    expect(result).toContain("<b>человека</b>");
    expect(result).toContain("<tg-spoiler>Пушкин</tg-spoiler>");
  });

  it("formats question without spoilers", () => {
    const result = formatQuestionForTelegram(mockQuestion, 0, { useSpoilers: false });
    expect(result).toContain("<b>Ответ:</b> Пушкин");
    expect(result).not.toContain("<tg-spoiler>");
  });

  it("includes zachet when enabled", () => {
    const result = formatQuestionForTelegram(mockQuestion, 0, {
      useSpoilers: true,
      includeZachet: true,
    });
    expect(result).toContain("<i>Зачёт:</i>");
    expect(result).toContain("А.С. Пушкин");
  });

  it("excludes zachet when disabled", () => {
    const result = formatQuestionForTelegram(mockQuestion, 0, { includeZachet: false });
    expect(result).not.toContain("Зачёт:");
  });

  it("includes comment when enabled", () => {
    const result = formatQuestionForTelegram(mockQuestion, 0, { includeComment: true });
    expect(result).toContain("<i>Комментарий:</i>");
  });

  it("includes source when enabled", () => {
    const result = formatQuestionForTelegram(mockQuestion, 0, { includeSource: true });
    expect(result).toContain("<i>Источник:</i>");
  });

  it("includes author when enabled", () => {
    const result = formatQuestionForTelegram(mockQuestion, 0, { includeAuthor: true });
    expect(result).toContain("<i>Автор:</i>");
    expect(result).toContain("Автор Вопроса");
  });

  it("uses index for question number when number is null", () => {
    const q = { ...mockQuestion, number: null };
    const result = formatQuestionForTelegram(q, 4, {});
    expect(result).toContain("<b>Вопрос 5</b>");
  });
});
