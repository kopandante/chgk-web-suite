// Typography utilities for CHGK parser

const LOWERCASE_RUSSIAN = new Set("абвгдеёжзийклмнопрстуфхцчшщъыьэюя".split(""));
const UPPERCASE_RUSSIAN = new Set("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split(""));
const POTENTIAL_ACCENTS = new Set("АОУЫЭЯЕЮИ".split(""));
const BAD_BEGINNINGS = new Set(["Мак", "мак", "О'", "о'", "О'", "о'"]);

const NO_BREAK_SEQUENCES = [
  "а",
  "без",
  "в",
  "во",
  "где",
  "для",
  "же",
  "за",
  "и",
  "или",
  "из",
  "из-за",
  "к",
  "как",
  "на",
  "над",
  "не",
  "ни",
  "но",
  "о",
  "от",
  "по",
  "под",
  "при",
  "с",
  "со",
  "то",
  "у",
  "что",
  "перед",
];

const NO_BREAK_SEQUENCES_LEFT = ["бы", "ли", "же", "—", "–"];

// Mapping Latin letters to Cyrillic equivalents for accent conversion
// All Latin accented vowels are converted to Cyrillic + combining acute
const LETTERS_MAPPING: Record<string, string> = {
  a: "а",
  e: "е",
  y: "у",
  o: "о",
  u: "и",
  A: "А",
  E: "Е",
  Y: "У",
  O: "О",
  U: "И",
};

const CYRILLIC_CHARS = new Set(
  "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split(""),
);
const ACCENTS_TO_FIX = new Set(["\u0300", "\u0341", "\u0301"]);

const RE_BAD_WSP_START = /^[ \u00a0\n]+/;
const RE_BAD_WSP_END = /[ \u00a0\n]+$/;
const RE_NBH = /(^|[^а-яё])([а-яё]{0,3}-[а-яё]{0,3})([^а-яё]|$)/i;
const RE_BAD_CYR_QUOTES = /"[а-яА-ЯЁё0-9,.:!? ]+?"/g;
const RE_BAD_LAT_QUOTES = /'[a-zA-Z0-9,.:!? ]+?'/g;
const RE_BAD_LAT_DQUOTES = /"[a-zA-Z0-9,.:!? ]+?"/g;
const RE_PERCENT = /(%[0-9a-fA-F]{2})+/g;

export function removeExcessiveWhitespace(s: string): string {
  s = s.replace(RE_BAD_WSP_START, "");
  s = s.replace(RE_BAD_WSP_END, "");
  s = s.replace(/\s+\n\s+/g, "\n");
  return s;
}

class QuoteFixer {
  private s: string;
  private newS: string[];
  private level = 0;
  private lastOpeningQuote: Record<number, string> = {};
  private quoteChars: Record<number, [string, number, string, number]> = {};

  constructor(s: string) {
    this.s = s;
    this.newS = s.split("");
  }

  private isSpace(char: string): boolean {
    return char === " " || char === "\u00a0";
  }

  private prev(i: number): string | null {
    if (i === 0) return null;
    return this.newS[i - 1];
  }

  private next(i: number): string | null {
    if (i + 1 === this.newS.length) return null;
    return this.newS[i + 1];
  }

  fix(): string {
    const c = this.newS;

    for (let i = 0; i < c.length; i++) {
      if (c[i] === "«" || c[i] === "„") {
        this.level += 1;
        this.quoteChars[i] = ["opening", this.level, c[i], i];
        this.lastOpeningQuote[this.level] = c[i];
      } else if (c[i] === "»" || c[i] === "\u201D") {
        this.quoteChars[i] = ["closing", this.level, c[i], i];
        this.level -= 1;
      } else if (c[i] === '"') {
        const prevChar = this.prev(i);
        const nextChar = this.next(i);

        if (
          this.level === 0 ||
          prevChar === null ||
          (this.isSpace(prevChar) && nextChar !== null && !this.isSpace(nextChar))
        ) {
          this.level += 1;
          this.quoteChars[i] = ["opening", this.level, c[i], i];
          this.lastOpeningQuote[this.level] = c[i];
        } else if (this.lastOpeningQuote[this.level] === '"') {
          this.quoteChars[i] = ["closing", this.level, c[i], i];
          this.level -= 1;
        } else {
          this.level += 1;
          this.quoteChars[i] = ["opening", this.level, c[i], i];
          this.lastOpeningQuote[this.level] = c[i];
        }
      } else if (c[i] === "\u201C") {
        if (this.lastOpeningQuote[this.level] === "„") {
          this.quoteChars[i] = ["closing", this.level, c[i], i];
          this.level -= 1;
        } else {
          this.level += 1;
          this.quoteChars[i] = ["opening", this.level, c[i], i];
        }
      }
    }

    if (this.level !== 0) {
      return this.s;
    }

    for (const qc of Object.keys(this.quoteChars)) {
      const idx = Number.parseInt(qc, 10);
      const tup = this.quoteChars[idx];

      if (tup[0] === "opening") {
        this.newS[idx] = tup[1] % 2 ? "«" : "„";
      } else if (tup[0] === "closing") {
        this.newS[idx] = tup[1] % 2 ? "»" : "\u201C";
      }
    }

    return this.newS.join("");
  }
}

export function getQuotesRight(s: string): string {
  if (s.includes('"') || (s.includes("\u201D") && !s.includes("„"))) {
    s = new QuoteFixer(s).fix();
  }

  s = s.replace(/(\w)'/gu, "$1\u2019");
  s = s.replace(/'(\w)/gu, "\u2018$1");

  return s;
}

export function getDashesRight(s: string): string {
  s = s.replace(/(?<=\s)-+(?=\s)/g, "—");
  s = s.replace(/ – /g, " — ");
  return s;
}

export function replaceNoBreak(s: string, spaces = true, hyphens = true): string {
  if (spaces) {
    const allSequences = [
      ...NO_BREAK_SEQUENCES,
      ...NO_BREAK_SEQUENCES.map((x) => x.charAt(0).toUpperCase() + x.slice(1)),
    ];

    for (const sp of allSequences) {
      const rFrom = new RegExp(`(^|[ \u00a0])${sp} `, "g");
      s = s.replace(rFrom, `$1${sp}\u00a0`);
    }

    const allLeftSequences = [
      ...NO_BREAK_SEQUENCES_LEFT,
      ...NO_BREAK_SEQUENCES_LEFT.map((x) => x.charAt(0).toUpperCase() + x.slice(1)),
    ];

    for (const sp of allLeftSequences) {
      const rFrom = new RegExp(` ${sp}([ \u00a0]|$)`, "g");
      s = s.replace(rFrom, `\u00a0${sp}$1`);
    }
  }

  if (hyphens) {
    let match = RE_NBH.exec(s);
    while (match) {
      const word = match[2];
      s = s.replace(word, word.replace("-", "\u2011"));
      match = RE_NBH.exec(s);
    }
  }

  return s;
}

export function detectAccent(s: string): string {
  const russianChars = [...LOWERCASE_RUSSIAN, ...UPPERCASE_RUSSIAN].join("");
  const wordRegex = new RegExp(`[^${russianChars}]+`, "g");

  for (const word of s.split(wordRegex)) {
    if (word.toUpperCase() !== word && word.length > 1) {
      let wordNew = word;
      let i = 1;

      while (i < wordNew.length) {
        const char = wordNew[i];
        if (
          POTENTIAL_ACCENTS.has(char) &&
          !BAD_BEGINNINGS.has(wordNew.slice(0, i)) &&
          (i === 1 || !wordNew[i - 1].match(/[А-ЯЁ]/)) &&
          (i + 1 === wordNew.length || !wordNew[i + 1].match(/[А-ЯЁ]/))
        ) {
          wordNew = `${wordNew.slice(0, i)}${wordNew[i].toLowerCase()}\u0301${wordNew.slice(i + 1)}`;
        }
        i += 1;
      }

      if (word !== wordNew) {
        s = s.replace(word, wordNew);
      }
    }
  }

  return s;
}

function fixAccentsFunc(
  s: string,
  mode: "on" | "smart" | "off" | "light" | "smart_disable" = "on",
): string {
  if (mode === "on" || mode === "smart") {
    s = detectAccent(s);
  }

  const replacements: Record<string, string> = {};

  for (const word of s.split(/\s+/)) {
    if (word.length <= 1) continue;

    for (let i = 0; i < word.length; i++) {
      const char = word[i];

      if (!CYRILLIC_CHARS.has(char)) {
        // Check if this is a Latin accented letter
        const normalized = char.normalize("NFD");
        if (
          normalized !== char &&
          normalized[0] in LETTERS_MAPPING &&
          ACCENTS_TO_FIX.has(normalized[1])
        ) {
          // Check surrounding characters to decide whether to convert
          const prevChar = i > 0 ? word[i - 1] : "";
          const nextChar = i < word.length - 1 ? word[i + 1] : "";
          const prevIsCyrillic = prevChar && CYRILLIC_CHARS.has(prevChar);
          const nextIsCyrillic = nextChar && CYRILLIC_CHARS.has(nextChar);

          // Convert to Cyrillic only if surrounded by Cyrillic characters
          if (prevIsCyrillic || nextIsCyrillic) {
            const replacement = `${LETTERS_MAPPING[normalized[0]]}\u0301${normalized.slice(2)}`;
            if (!replacements[char]) {
              replacements[char] = replacement;
            }
          }
        }
      } else if (i < word.length - 1 && ACCENTS_TO_FIX.has(word[i + 1])) {
        // Normalize accent for Cyrillic characters
        const key = char + word[i + 1];
        replacements[key] = `${char}\u0301`;
      }
    }
  }

  for (const [key, val] of Object.entries(replacements)) {
    s = s.replaceAll(key, val);
  }

  return s;
}

export function percentDecode(s: string): string {
  const matches = [...s.matchAll(RE_PERCENT)].map((m) => m[0]).sort((a, b) => b.length - a.length);

  for (const gr of matches) {
    try {
      s = s.replace(gr, decodeURIComponent(gr));
    } catch {
      // ignore decoding errors
    }
  }

  return s;
}

export interface TypographyOptions {
  wsp?: "on" | "off";
  quotes?: "on" | "off" | "smart" | "smart_disable";
  dashes?: "on" | "off";
  accents?: "on" | "off" | "smart" | "smart_disable" | "light";
  percent?: "on" | "off";
}

export function typography(s: string, options: TypographyOptions = {}): string {
  const { wsp = "on", quotes = "on", dashes = "on", accents = "on", percent = "on" } = options;

  if (wsp === "on") {
    s = removeExcessiveWhitespace(s);
  }

  if (quotes === "on" || quotes === "smart") {
    s = getQuotesRight(s);
  }

  if (quotes === "on" || (quotes.startsWith("smart") && s.includes("'s"))) {
    s = s.replaceAll("'s", "\u2019s");
  }

  if (quotes.startsWith("smart")) {
    let match = s.match(RE_BAD_CYR_QUOTES);
    const fixStart = s.includes("«") ? "„" : "«";
    const fixEnd = s.includes("«") ? "\u201D" : "»";

    while (match) {
      for (const grp of match) {
        s = s.replace(grp, `${fixStart}${grp.slice(1, -1)}${fixEnd}`);
      }
      match = s.match(RE_BAD_CYR_QUOTES);
    }

    match = s.match(RE_BAD_LAT_QUOTES);
    while (match) {
      for (const grp of match) {
        s = s.replace(grp, `'${grp.slice(1, -1)}'`);
      }
      match = s.match(RE_BAD_LAT_QUOTES);
    }

    match = s.match(RE_BAD_LAT_DQUOTES);
    while (match) {
      for (const grp of match) {
        s = s.replace(grp, `"${grp.slice(1, -1)}"`);
      }
      match = s.match(RE_BAD_LAT_DQUOTES);
    }
  }

  if (dashes === "on") {
    s = getDashesRight(s);
  }

  if (accents === "on" || accents === "light" || accents.startsWith("smart")) {
    s = fixAccentsFunc(s, accents);
  }

  if (percent === "on") {
    s = percentDecode(s);
  }

  return s;
}

export function recursiveTypography(
  s: string | string[] | unknown,
  options: TypographyOptions = {},
): string | string[] | unknown {
  if (typeof s === "string") {
    return typography(s, options);
  }

  if (Array.isArray(s)) {
    return s.map((element) => recursiveTypography(element, options));
  }

  return s;
}
