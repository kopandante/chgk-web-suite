// SQLite schema for CHGK packages

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    editor TEXT,
    date TEXT,
    question_count INTEGER DEFAULT 0,
    tour_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tours (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    title TEXT,
    order_num INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    tour_id TEXT,
    order_num INTEGER NOT NULL,
    number INTEGER,
    question TEXT NOT NULL,
    answer TEXT,
    zachet TEXT,
    nezachet TEXT,
    comment TEXT,
    source TEXT,
    author TEXT,
    handout TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    data TEXT NOT NULL,
    content_type TEXT NOT NULL,
    filename TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tours_package ON tours(package_id);
  CREATE INDEX IF NOT EXISTS idx_questions_package ON questions(package_id);
  CREATE INDEX IF NOT EXISTS idx_questions_tour ON questions(tour_id);
  CREATE INDEX IF NOT EXISTS idx_images_question ON images(question_id);
`;

export interface Package {
  id: string;
  title: string;
  editor: string | null;
  date: string | null;
  question_count: number;
  tour_count: number;
  created_at: number;
  updated_at: number;
}

export interface Tour {
  id: string;
  package_id: string;
  title: string | null;
  order_num: number;
  created_at: number;
}

export interface Question {
  id: string;
  package_id: string;
  tour_id: string | null;
  order_num: number;
  number: number | null;
  question: string;
  answer: string | null;
  zachet: string | null;
  nezachet: string | null;
  comment: string | null;
  source: string | null;
  author: string | null;
  handout: string | null;
  created_at: number;
}

export interface Image {
  id: string;
  question_id: string;
  data: string; // Base64 encoded
  content_type: string;
  filename: string | null;
  created_at: number;
}
