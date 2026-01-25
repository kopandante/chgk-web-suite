// Compose parsed structure to 4S format (matching chgksuite format)

import type { ParsedStructure } from "./index";

const SEP = "\n";

const TYPES_MAPPING: Record<string, string> = {
  meta: "# ",
  section: "## ",
  tour: "## ",
  tourrev: "## ",
  editor: "#EDITOR ",
  heading: "### ",
  ljheading: "###LJ ",
  date: "#DATE ",
  question: "? ",
  answer: "! ",
  zachet: "= ",
  nezachet: "!= ",
  source: "^ ",
  comment: "/ ",
  author: "@ ",
  handout: "> ",
};

const QUESTION_LABELS = [
  "handout",
  "question",
  "answer",
  "zachet",
  "nezachet",
  "comment",
  "source",
  "author",
] as const;

function removeDoubleSeparators(text: string): string {
  return text.replace(/\n\n+/g, "\n").replace(/\r\r+/g, "\r");
}

function formatElement(z: unknown): string {
  if (typeof z === "string") {
    return removeDoubleSeparators(z);
  }

  if (Array.isArray(z)) {
    if (z.length > 0 && Array.isArray(z[1])) {
      // Format: [header, [items...]]
      return (
        removeDoubleSeparators(z[0] as string) +
        SEP +
        "- " +
        (z[1] as string[]).map((x) => removeDoubleSeparators(x)).join(`${SEP}- `)
      );
    }
    // Format: [items...] - list of items
    return `${SEP}- ${z.map((x) => removeDoubleSeparators(String(x))).join(`${SEP}- `)}`;
  }

  return String(z);
}

function isZero(s: unknown): boolean {
  const str = String(s);
  if (str.startsWith("0")) return true;
  const num = Number.parseInt(str, 10);
  return Number.isNaN(num) || num === 0;
}

interface QuestionData {
  number?: number | string;
  handout?: string | string[];
  question?: string | string[];
  answer?: string | string[];
  zachet?: string | string[];
  nezachet?: string | string[];
  comment?: string | string[];
  source?: string | string[];
  author?: string | string[];
  overrides?: Record<string, string>;
}

interface ComposeOptions {
  numbersHandling?: "default" | "all" | "none";
}

export function compose4s(structure: ParsedStructure, options: ComposeOptions = {}): string {
  const { numbersHandling = "default" } = options;
  let result = "";
  let firstNumber = true;

  for (const element of structure) {
    const [type, value] = element;

    if (type in TYPES_MAPPING && TYPES_MAPPING[type]) {
      result += TYPES_MAPPING[type] + formatElement(value) + SEP + SEP;
    } else if (type === "Question" && typeof value === "object" && value !== null) {
      let tmp = "";
      const q = value as QuestionData;
      const overrides = q.overrides || {};

      // Handle question number
      if (q.number !== undefined) {
        if (!numbersHandling || numbersHandling === "default") {
          if (isZero(q.number)) {
            tmp += `№ ${String(q.number)}${SEP}`;
          } else if (firstNumber && Number(q.number) > 1) {
            tmp += `№№ ${String(q.number)}${SEP}`;
          }
        } else if (numbersHandling === "all") {
          tmp += `№ ${String(q.number)}${SEP}`;
        }
        if (!isZero(q.number)) {
          firstNumber = false;
        }
      }

      // Process each question label in order
      for (const label of QUESTION_LABELS) {
        const overrideLabel =
          label in overrides ? `!!${overrides[label as keyof typeof overrides]} ` : "";

        if (label in q && label in TYPES_MAPPING) {
          const fieldValue = q[label as keyof QuestionData];
          if (fieldValue !== undefined) {
            tmp += TYPES_MAPPING[label] + overrideLabel + formatElement(fieldValue) + SEP;
          }
        }
      }

      // Clean up multiple separators
      tmp = tmp.replace(new RegExp(`${SEP}+`, "g"), SEP);
      tmp = tmp.replace(/\r\r/g, "\r");
      result += tmp + SEP;
    }
  }

  return result;
}
