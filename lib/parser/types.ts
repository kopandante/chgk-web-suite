// Types for CHGK parser

export const QUESTION_LABELS = [
  "handout",
  "question",
  "answer",
  "zachet",
  "nezachet",
  "comment",
  "source",
  "author",
  "number",
  "setcounter",
] as const;

export type QuestionLabel = (typeof QUESTION_LABELS)[number];

export type FieldType =
  | QuestionLabel
  | "tour"
  | "tourrev"
  | "editor"
  | "meta"
  | "heading"
  | "ljheading"
  | "date"
  | "Question"
  | "";

export type FieldValue = string | string[] | [string, string[]];

export interface Question {
  question: FieldValue;
  answer?: FieldValue;
  zachet?: FieldValue;
  nezachet?: FieldValue;
  comment?: FieldValue;
  source?: FieldValue;
  author?: FieldValue;
  handout?: FieldValue;
  number?: string | number;
  overrides?: Record<string, string>;
}

export type StructureElement = [FieldType, FieldValue] | ["Question", Question];

export type ParsedStructure = StructureElement[];

export interface ParserOptions {
  language?: "ru" | "en" | "uz" | "uz_cyr";
  typographyQuotes?: "on" | "off" | "smart" | "smart_disable";
  typographyDashes?: "on" | "off";
  typographyAccents?: "on" | "off" | "smart" | "smart_disable" | "light";
  typographyWhitespace?: "on" | "off";
  typographyPercent?: "on" | "off";
  numbersHandling?: "default" | "all";
  singleNumberLineHandling?: "off" | "on" | "smart";
  preserveFormatting?: boolean;
  links?: "unwrap" | "old";
  debug?: boolean;
}

export const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  language: "ru",
  typographyQuotes: "on",
  typographyDashes: "on",
  typographyAccents: "on",
  typographyWhitespace: "on",
  typographyPercent: "on",
  numbersHandling: "default",
  singleNumberLineHandling: "smart",
  preserveFormatting: false,
  links: "unwrap",
  debug: false,
};

export interface QuestionLabels {
  question: string;
  answer: string;
  zachet: string;
  nezachet: string;
  comment: string;
  source: string;
  author: string;
  handout: string;
}

export const LABELS_RU: QuestionLabels = {
  question: "Вопрос",
  answer: "Ответ",
  zachet: "Зачет",
  nezachet: "Незачет",
  comment: "Комментарий",
  source: "Источник",
  author: "Автор",
  handout: "Раздаточный материал",
};
