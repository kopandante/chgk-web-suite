// Parser tests
import { describe, expect, test, beforeAll } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { basename, join } from "path";
import { ChgkParser, parseTxt } from "../lib/parser/index";
import { compose4s } from "../lib/parser/compose-4s";
import { parseDocx } from "../lib/parser/docx";
import { registerDom } from "./setup";

// Register DOM globals before tests
beforeAll(() => {
  registerDom();
});

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

// Files to skip (known issues or special formats that need investigation)
const SKIP_CANONICAL = new Set([
  "balt09-1.txt", // encoding issues in test file
  "octo2021_khmelkov.docx", // created with --preserve-formatting flag (italic markers)
]);

// Get all canon files
const canonFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".canon"));

// Helper to normalize text for comparison
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n+$/g, "")
    .replace(/[ \t]+$/gm, "") // trim trailing whitespace from lines
    .trim();
}

describe("Parser canonical tests", () => {
  // Test TXT files
  const txtCanonFiles = canonFiles.filter(
    (f) => f.endsWith(".txt.canon") && !SKIP_CANONICAL.has(f.replace(".canon", "")),
  );

  for (const canonFile of txtCanonFiles) {
    const inputFile = canonFile.replace(".canon", "");

    test(`canonical: ${inputFile}`, () => {
      const inputPath = join(FIXTURES_DIR, inputFile);
      const canonPath = join(FIXTURES_DIR, canonFile);

      const inputContent = readFileSync(inputPath, "utf-8");
      const expectedOutput = readFileSync(canonPath, "utf-8");

      // Use parseTxt which escapes underscores like chgksuite
      const parsed = parseTxt(inputContent);
      const output = compose4s(parsed);

      expect(normalize(output)).toBe(normalize(expectedOutput));
    });
  }

  // Test DOCX files
  const docxCanonFiles = canonFiles.filter(
    (f) => f.endsWith(".docx.canon") && !SKIP_CANONICAL.has(f.replace(".canon", "")),
  );

  for (const canonFile of docxCanonFiles) {
    const inputFile = canonFile.replace(".canon", "");

    test(`canonical: ${inputFile}`, async () => {
      const inputPath = join(FIXTURES_DIR, inputFile);
      const canonPath = join(FIXTURES_DIR, canonFile);

      const expectedOutput = readFileSync(canonPath, "utf-8");

      // Parse DOCX with proper image handling and underscore escaping
      const buffer = readFileSync(inputPath);
      const { structure } = await parseDocx(buffer, undefined, "", basename(inputPath));
      const output = compose4s(structure);

      expect(normalize(output)).toBe(normalize(expectedOutput));
    });
  }
});

describe("Parser regex tests", () => {
  test("matches source pattern", () => {
    const parser = new ChgkParser();
    const result = parser.parse("Вопрос 1.\nТекст вопроса\nОтвет: ответ\nИсточник: wikipedia.org");

    const question = result.find(([type]) => type === "Question");
    expect(question).toBeDefined();

    const q = question![1] as Record<string, unknown>;
    expect(q.source).toBe("wikipedia.org");
  });

  test("matches author pattern", () => {
    const parser = new ChgkParser();
    const result = parser.parse("Вопрос 1.\nТекст вопроса\nОтвет: ответ\nАвтор: Иван Иванов");

    const question = result.find(([type]) => type === "Question");
    expect(question).toBeDefined();

    const q = question![1] as Record<string, unknown>;
    expect(q.author).toBe("Иван Иванов");
  });

  test("matches zachet pattern", () => {
    const parser = new ChgkParser();
    const result = parser.parse(
      "Вопрос 1.\nТекст вопроса\nОтвет: правильный ответ\nЗачёт: альтернативный ответ",
    );

    const question = result.find(([type]) => type === "Question");
    expect(question).toBeDefined();

    const q = question![1] as Record<string, unknown>;
    expect(q.zachet).toBe("альтернативный ответ");
  });

  test("parses tour headers", () => {
    const parser = new ChgkParser();
    const result = parser.parse("Тур 1\nВопрос 1.\nТекст\nОтвет: ответ");

    const tour = result.find(([type]) => type === "tour");
    expect(tour).toBeDefined();
  });

  test("parses multiple questions", () => {
    const parser = new ChgkParser();
    const result = parser.parse(`
Вопрос 1.
Первый вопрос
Ответ: первый

Вопрос 2.
Второй вопрос
Ответ: второй
`);

    const questions = result.filter(([type]) => type === "Question");
    expect(questions.length).toBe(2);
  });
});

describe("Typography tests", () => {
  test("handles quotes correctly", () => {
    const parser = new ChgkParser({ typographyQuotes: "on" });
    const result = parser.parse('Вопрос 1.\nОн сказал "привет"\nОтвет: ответ');

    const question = result.find(([type]) => type === "Question");
    const q = question![1] as Record<string, unknown>;
    const questionText = q.question as string;

    // Should have proper Russian quotes
    expect(questionText).toContain("«");
    expect(questionText).toContain("»");
  });
});

describe("Field extraction tests", () => {
  test("extracts all fields from complete question", () => {
    const parser = new ChgkParser();
    const result = parser.parse(`
Вопрос 1.
Текст вопроса про что-то интересное.
Ответ: правильный ответ
Зачёт: альтернативный ответ
Незачёт: неправильный ответ
Комментарий: пояснение к ответу
Источник: https://example.com
Автор: Иван Иванов
`);

    const question = result.find(([type]) => type === "Question");
    expect(question).toBeDefined();

    const q = question![1] as Record<string, unknown>;
    expect(q.question).toContain("интересное");
    expect(q.answer).toBe("правильный ответ");
    expect(q.zachet).toBe("альтернативный ответ");
    expect(q.nezachet).toBe("неправильный ответ");
    expect(q.comment).toBe("пояснение к ответу");
    expect(q.source).toBe("https://example.com");
    expect(q.author).toBe("Иван Иванов");
  });
});
