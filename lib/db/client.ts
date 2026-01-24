// Client-only database operations
// This module should only be imported in client components

import { get, set } from "idb-keyval";
import type { Database } from "sql.js";
import { type Package, type Question, SCHEMA, type Tour } from "./schema";

const DB_KEY = "chgk-web-db";
const SQL_WASM_URL = "https://sql.js.org/dist/sql-wasm.wasm";

let db: Database | null = null;
let sqlModule: Awaited<ReturnType<typeof import("sql.js").default>> | null = null;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function getSqlModule() {
  if (!sqlModule) {
    const initSqlJs = (await import("sql.js")).default;
    sqlModule = await initSqlJs({
      locateFile: () => SQL_WASM_URL,
    });
  }
  return sqlModule;
}

export async function loadDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await getSqlModule();

  const savedData = await get<Uint8Array>(DB_KEY);

  if (savedData) {
    db = new SQL.Database(savedData);
    // Run migrations for existing databases
    runMigrations(db);
  } else {
    db = new SQL.Database();
    db.run(SCHEMA);
    await saveDatabase();
  }

  return db;
}

function runMigrations(database: Database): void {
  // Check if 'number' column exists in questions table
  const tableInfo = database.exec("PRAGMA table_info(questions)");
  if (tableInfo.length > 0) {
    const columns = tableInfo[0].values.map((row) => row[1]);
    if (!columns.includes("number")) {
      database.run("ALTER TABLE questions ADD COLUMN number INTEGER");
    }
  }
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await set(DB_KEY, data);
}

// Package operations

export async function createPackage(data: {
  title: string;
  editor?: string;
  date?: string;
}): Promise<Package> {
  const database = await loadDatabase();
  const now = Date.now();
  const id = generateId();

  database.run(
    `INSERT INTO packages (id, title, editor, date, question_count, tour_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
    [id, data.title, data.editor || null, data.date || null, now, now],
  );

  await saveDatabase();

  return {
    id,
    title: data.title,
    editor: data.editor || null,
    date: data.date || null,
    question_count: 0,
    tour_count: 0,
    created_at: now,
    updated_at: now,
  };
}

export async function getAllPackages(): Promise<Package[]> {
  const database = await loadDatabase();
  const result = database.exec("SELECT * FROM packages ORDER BY updated_at DESC");

  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map((row) => {
    const pkg: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      pkg[col] = row[i];
    });
    return pkg as unknown as Package;
  });
}

export async function getPackage(id: string): Promise<Package | null> {
  const database = await loadDatabase();
  const result = database.exec("SELECT * FROM packages WHERE id = ?", [id]);

  if (!result.length || !result[0].values.length) return null;

  const columns = result[0].columns;
  const row = result[0].values[0];
  const pkg: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    pkg[col] = row[i];
  });

  return pkg as unknown as Package;
}

export async function updatePackage(
  id: string,
  data: Partial<Pick<Package, "title" | "editor" | "date">>,
): Promise<void> {
  const database = await loadDatabase();
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.title !== undefined) {
    updates.push("title = ?");
    values.push(data.title);
  }
  if (data.editor !== undefined) {
    updates.push("editor = ?");
    values.push(data.editor);
  }
  if (data.date !== undefined) {
    updates.push("date = ?");
    values.push(data.date);
  }

  updates.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);

  database.run(`UPDATE packages SET ${updates.join(", ")} WHERE id = ?`, values);
  await saveDatabase();
}

export async function deletePackage(id: string): Promise<void> {
  const database = await loadDatabase();
  database.run("DELETE FROM packages WHERE id = ?", [id]);
  await saveDatabase();
}

// Tour operations

export async function createTour(data: {
  package_id: string;
  title?: string;
  order_num: number;
}): Promise<Tour> {
  const database = await loadDatabase();
  const now = Date.now();
  const id = generateId();

  database.run(
    `INSERT INTO tours (id, package_id, title, order_num, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.package_id, data.title || null, data.order_num, now],
  );

  // Update tour count
  database.run(
    `UPDATE packages SET tour_count = (SELECT COUNT(*) FROM tours WHERE package_id = ?), updated_at = ? WHERE id = ?`,
    [data.package_id, now, data.package_id],
  );

  await saveDatabase();

  return {
    id,
    package_id: data.package_id,
    title: data.title || null,
    order_num: data.order_num,
    created_at: now,
  };
}

export async function getToursByPackage(packageId: string): Promise<Tour[]> {
  const database = await loadDatabase();
  const result = database.exec("SELECT * FROM tours WHERE package_id = ? ORDER BY order_num", [
    packageId,
  ]);

  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map((row) => {
    const tour: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      tour[col] = row[i];
    });
    return tour as unknown as Tour;
  });
}

export async function deleteTour(id: string): Promise<void> {
  const database = await loadDatabase();

  // Get package_id first
  const result = database.exec("SELECT package_id FROM tours WHERE id = ?", [id]);
  if (result.length && result[0].values.length) {
    const packageId = result[0].values[0][0] as string;

    database.run("DELETE FROM tours WHERE id = ?", [id]);

    // Update tour count
    const now = Date.now();
    database.run(
      `UPDATE packages SET tour_count = (SELECT COUNT(*) FROM tours WHERE package_id = ?), updated_at = ? WHERE id = ?`,
      [packageId, now, packageId],
    );
  }

  await saveDatabase();
}

// Question operations

export async function createQuestion(data: {
  package_id: string;
  tour_id?: string;
  order_num: number;
  number?: number;
  question: string;
  answer?: string;
  zachet?: string;
  nezachet?: string;
  comment?: string;
  source?: string;
  author?: string;
  handout?: string;
}): Promise<Question> {
  const database = await loadDatabase();
  const now = Date.now();
  const id = generateId();

  database.run(
    `INSERT INTO questions (id, package_id, tour_id, order_num, number, question, answer, zachet, nezachet, comment, source, author, handout, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.package_id,
      data.tour_id || null,
      data.order_num,
      data.number ?? null,
      data.question,
      data.answer || null,
      data.zachet || null,
      data.nezachet || null,
      data.comment || null,
      data.source || null,
      data.author || null,
      data.handout || null,
      now,
    ],
  );

  // Update question count
  database.run(
    `UPDATE packages SET question_count = (SELECT COUNT(*) FROM questions WHERE package_id = ?), updated_at = ? WHERE id = ?`,
    [data.package_id, now, data.package_id],
  );

  await saveDatabase();

  return {
    id,
    package_id: data.package_id,
    tour_id: data.tour_id || null,
    order_num: data.order_num,
    number: data.number ?? null,
    question: data.question,
    answer: data.answer || null,
    zachet: data.zachet || null,
    nezachet: data.nezachet || null,
    comment: data.comment || null,
    source: data.source || null,
    author: data.author || null,
    handout: data.handout || null,
    created_at: now,
  };
}

export async function getQuestionsByPackage(packageId: string): Promise<Question[]> {
  const database = await loadDatabase();
  const result = database.exec("SELECT * FROM questions WHERE package_id = ? ORDER BY order_num", [
    packageId,
  ]);

  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map((row) => {
    const q: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      q[col] = row[i];
    });
    return q as unknown as Question;
  });
}

export async function getQuestionsByTour(tourId: string): Promise<Question[]> {
  const database = await loadDatabase();
  const result = database.exec("SELECT * FROM questions WHERE tour_id = ? ORDER BY order_num", [
    tourId,
  ]);

  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map((row) => {
    const q: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      q[col] = row[i];
    });
    return q as unknown as Question;
  });
}

export async function updateQuestion(
  id: string,
  data: Partial<Omit<Question, "id" | "package_id" | "created_at">>,
): Promise<void> {
  const database = await loadDatabase();
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  const fields = [
    "tour_id",
    "order_num",
    "number",
    "question",
    "answer",
    "zachet",
    "nezachet",
    "comment",
    "source",
    "author",
    "handout",
  ] as const;

  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(data[field] as string | number | null);
    }
  }

  if (updates.length === 0) return;

  values.push(id);
  database.run(`UPDATE questions SET ${updates.join(", ")} WHERE id = ?`, values);

  // Update package updated_at
  const result = database.exec("SELECT package_id FROM questions WHERE id = ?", [id]);
  if (result.length && result[0].values.length) {
    const packageId = result[0].values[0][0] as string;
    database.run("UPDATE packages SET updated_at = ? WHERE id = ?", [Date.now(), packageId]);
  }

  await saveDatabase();
}

export async function deleteQuestion(id: string): Promise<void> {
  const database = await loadDatabase();

  // Get package_id first
  const result = database.exec("SELECT package_id FROM questions WHERE id = ?", [id]);
  if (result.length && result[0].values.length) {
    const packageId = result[0].values[0][0] as string;

    database.run("DELETE FROM questions WHERE id = ?", [id]);

    // Update question count
    const now = Date.now();
    database.run(
      `UPDATE packages SET question_count = (SELECT COUNT(*) FROM questions WHERE package_id = ?), updated_at = ? WHERE id = ?`,
      [packageId, now, packageId],
    );
  }

  await saveDatabase();
}

// Bulk import from parsed structure

export async function importParsedPackage(
  title: string,
  structure: Array<[string, unknown]>,
): Promise<string> {
  const database = await loadDatabase();
  const now = Date.now();
  const packageId = generateId();

  let editor: string | null = null;
  let date: string | null = null;
  let questionCount = 0;
  let tourCount = 0;
  let currentTourId: string | null = null;
  let questionOrder = 0;
  let tourOrder = 0;

  // First pass: count and extract metadata
  for (const [type, value] of structure) {
    if (type === "editor" && typeof value === "string") {
      editor = value;
    } else if (type === "date" && typeof value === "string") {
      date = value;
    } else if (type === "Question") {
      questionCount++;
    } else if (type === "tour" || type === "tourrev") {
      tourCount++;
    }
  }

  // Create package
  database.run(
    `INSERT INTO packages (id, title, editor, date, question_count, tour_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [packageId, title, editor, date, questionCount, tourCount, now, now],
  );

  // Second pass: create tours and questions
  for (const [type, value] of structure) {
    if (type === "tour" || type === "tourrev") {
      const tourId = generateId();
      const tourTitle = typeof value === "string" ? value : null;

      database.run(
        `INSERT INTO tours (id, package_id, title, order_num, created_at) VALUES (?, ?, ?, ?, ?)`,
        [tourId, packageId, tourTitle, tourOrder, now],
      );

      currentTourId = tourId;
      tourOrder++;
    } else if (type === "Question" && typeof value === "object" && value !== null) {
      const q = value as Record<string, unknown>;
      const questionId = generateId();

      const questionNumber =
        typeof q.number === "number"
          ? q.number
          : typeof q.number === "string"
            ? Number.parseInt(q.number, 10) || null
            : null;
      const questionText = stringifyField(q.question);
      const answerText = stringifyField(q.answer);
      const zachetText = stringifyField(q.zachet);
      const nezachetText = stringifyField(q.nezachet);
      const commentText = stringifyField(q.comment);
      const sourceText = stringifyField(q.source);
      const authorText = stringifyField(q.author);
      const handoutText = stringifyField(q.handout);

      database.run(
        `INSERT INTO questions (id, package_id, tour_id, order_num, number, question, answer, zachet, nezachet, comment, source, author, handout, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          packageId,
          currentTourId,
          questionOrder,
          questionNumber,
          questionText,
          answerText,
          zachetText,
          nezachetText,
          commentText,
          sourceText,
          authorText,
          handoutText,
          now,
        ],
      );

      questionOrder++;
    }
  }

  await saveDatabase();
  return packageId;
}

function stringifyField(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("\n");
  }
  return JSON.stringify(value);
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const SQL = await getSqlModule();

  db = new SQL.Database();
  db.run(SCHEMA);
  await saveDatabase();
}
