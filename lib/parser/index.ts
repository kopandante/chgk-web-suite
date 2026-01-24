// CHGK Parser - TypeScript port from Python chgksuite

import { recursiveTypography, removeExcessiveWhitespace } from "../typography";
import {
  DATE_RE1,
  DATE_RE2,
  type ParserRegexes,
  RE_NUM,
  RE_NUM_START,
  REGEXES_RU,
  TOUR_NUMBERS_AS_WORDS,
  ZERO_PREFIXES,
} from "./regexes";
import {
  DEFAULT_PARSER_OPTIONS,
  type FieldType,
  type FieldValue,
  LABELS_RU,
  type ParsedStructure,
  type ParserOptions,
  QUESTION_LABELS,
  type Question,
  type QuestionLabels,
} from "./types";

const SEP = "\n";

type StructureItem = [FieldType, FieldValue];

function partition(arr: string, indices: number[]): string[] {
  const result: string[] = [];
  const allIndices = [0, ...indices, arr.length];

  for (let i = 0; i < allIndices.length - 1; i++) {
    result.push(arr.slice(allIndices[i], allIndices[i + 1]));
  }

  return result;
}

function checkDate(match: RegExpMatchArray, parseString: string): boolean {
  try {
    const dateStr = match[0];
    let parsed: Date;

    if (parseString === "%d.%m.%Y") {
      const [day, month, year] = dateStr.split(".").map(Number);
      parsed = new Date(year, month - 1, day);
    } else {
      const [year, month, day] = dateStr.split("-").map(Number);
      parsed = new Date(year, month - 1, day);
    }

    const today = new Date();
    const yearDiff = (parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    return parsed.getFullYear() >= 1980 && (parsed < today || yearDiff <= 365);
  } catch {
    return false;
  }
}

function searchForDate(str: string): RegExpMatchArray | null {
  for (const match of str.matchAll(new RegExp(DATE_RE1, "g"))) {
    if (checkDate(match, "%d.%m.%Y")) {
      return match;
    }
  }

  for (const match of str.matchAll(new RegExp(DATE_RE2, "g"))) {
    if (checkDate(match, "%Y-%m-%d")) {
      return match;
    }
  }

  return null;
}

export class ChgkParser {
  private static BADNEXTFIELDS = new Set(["question", "answer"]);

  private defaultAuthor: string;
  private regexes: ParserRegexes;
  private options: Required<ParserOptions>;
  private labels: QuestionLabels;
  private questionStub: string;
  private structure: StructureItem[] = [];

  constructor(options: ParserOptions = {}, defaultAuthor = "") {
    this.defaultAuthor = defaultAuthor;
    this.options = { ...DEFAULT_PARSER_OPTIONS, ...options } as Required<ParserOptions>;
    this.regexes = REGEXES_RU;
    this.labels = LABELS_RU;

    if (this.options.language === "uz" || this.options.language === "uz_cyr") {
      this.questionStub = `{} – ${this.labels.question}.`;
    } else {
      this.questionStub = `${this.labels.question} {}.`;
    }

    if (this.options.language === "en") {
      this.options.typographyQuotes = "off";
    }
  }

  private removeFormatting(str: string): string {
    return str.replace(/_/g, "");
  }

  private mergeToNext(index: number): void {
    const target = this.structure.splice(index, 1)[0];
    const current = this.structure[index];
    if (typeof current[1] === "string" && typeof target[1] === "string") {
      current[1] = target[1] + SEP + current[1];
    }
  }

  private mergeToPrevious(index: number): void {
    const target = index - 1;
    const removed = this.structure.splice(index, 1)[0];
    const prev = this.structure[target];

    if (typeof prev[1] === "string" && typeof removed[1] === "string") {
      prev[1] = prev[1] ? prev[1] + SEP + removed[1] : removed[1];
    }
  }

  private findNextFieldname(index: number): FieldType | undefined {
    let target = index + 1;

    if (target < this.structure.length) {
      while (target < this.structure.length - 1 && this.structure[target][0] === "") {
        target += 1;
      }
      return this.structure[target][0];
    }

    return undefined;
  }

  private mergeYToX(x: FieldType, y: FieldType): void {
    let i = 0;

    while (i < this.structure.length) {
      if (this.structure[i][0] === x) {
        while (i + 1 < this.structure.length && this.structure[i + 1][0] !== y) {
          this.mergeToPrevious(i + 1);
        }
      }
      i += 1;
    }
  }

  private mergeToXUntilNextField(x: FieldType): void {
    let i = 0;

    while (i < this.structure.length) {
      if (this.structure[i][0] === x) {
        while (
          i + 1 < this.structure.length &&
          this.structure[i + 1][0] === "" &&
          !ChgkParser.BADNEXTFIELDS.has(this.findNextFieldname(i) ?? "")
        ) {
          this.mergeToPrevious(i + 1);
        }
      }
      i += 1;
    }
  }

  private dirtyMergeToXUntilNextField(x: FieldType): void {
    let i = 0;

    while (i < this.structure.length) {
      if (this.structure[i][0] === x) {
        while (i + 1 < this.structure.length && this.structure[i + 1][0] === "") {
          this.mergeToPrevious(i + 1);
        }
      }
      i += 1;
    }
  }

  private applyRegexes(st: StructureItem[]): void {
    let i = 0;
    const regexes = this.regexes;
    const excludedRegexes = new Set(["number", "date2", "handout_short"]);

    while (i < st.length) {
      const item = st[i];
      if (typeof item[1] !== "string") {
        i += 1;
        continue;
      }

      const content = this.removeFormatting(item[1]);
      const matchingRegexes: [string, number][] = [];

      for (const [regexName, regex] of Object.entries(regexes)) {
        if (excludedRegexes.has(regexName)) continue;

        const match = regex.exec(content);
        if (match) {
          matchingRegexes.push([regexName, match.index]);
        }
      }

      if (matchingRegexes.length === 1) {
        st[i][0] = matchingRegexes[0][0] as FieldType;
      } else if (matchingRegexes.length > 1) {
        const sorted = matchingRegexes.sort((a, b) => a[1] - b[1]);
        const slices: StructureItem[] = [];

        for (let j = 1; j < sorted.length; j++) {
          const endIndex = j + 1 < sorted.length ? sorted[j + 1][1] : item[1].length;
          slices.push([sorted[j][0] as FieldType, item[1].slice(sorted[j][1], endIndex)]);
        }

        for (const slice of slices) {
          st.splice(i + 1, 0, slice);
        }

        st[i][0] = sorted[0][0] as FieldType;
        st[i][1] = item[1].slice(0, sorted[1]?.[1] ?? item[1].length);
      }

      i += 1;
    }
  }

  private getStringsJoined(val: FieldValue): string {
    if (typeof val === "string") return val;

    if (Array.isArray(val)) {
      return val
        .map((v) => {
          if (typeof v === "string") return v;
          if (Array.isArray(v)) return v.join("\n");
          return "";
        })
        .join("\n");
    }

    return "";
  }

  private replaceInValue(val: FieldValue, search: string, replace: string): FieldValue {
    if (typeof val === "string") {
      return val.replace(search, replace).trim();
    }

    if (Array.isArray(val)) {
      return val.map((v) => {
        if (typeof v === "string") return v.replace(search, replace).trim();
        if (Array.isArray(v)) return v.map((x) => x.replace(search, replace).trim());
        return v;
      }) as FieldValue;
    }

    return val;
  }

  private tryExtractField(question: Question, k: keyof Question): void {
    const regex = this.regexes[k as keyof ParserRegexes];
    if (!regex) return;

    for (const k1 of Object.keys(question) as (keyof Question)[]) {
      const currVal = question[k1];
      if (!currVal) continue;

      const strings = this.getStringsJoined(currVal as FieldValue).split("\n");

      for (let i = 0; i < strings.length; i++) {
        const line = strings[i];
        const match = regex.exec(line);

        if (match) {
          const val = [line.replace(match[0], ""), ...strings.slice(i + 1)].join("\n").trim();

          if (val) {
            (question as unknown as Record<string, unknown>)[k] = val;
            question[k1] = this.replaceInValue(currVal as FieldValue, match[0], "") as never;
            question[k1] = this.replaceInValue(question[k1] as FieldValue, val, "") as never;
          }

          return;
        }
      }
    }
  }

  private postprocessQuestion(question: Question): void {
    if ("number" in question && typeof question.number === "string" && !question.number.trim()) {
      delete question.number;
    }

    const questionStr = this.getStringsJoined(question.question);

    for (const prefix of ZERO_PREFIXES) {
      if (questionStr.startsWith(prefix)) {
        question.question = this.replaceInValue(question.question, prefix, "");
        question.number = 0;
      }
    }

    for (const k of ["zachet", "nezachet", "source", "comment", "author"] as const) {
      if (!(k in question)) {
        this.tryExtractField(question, k);
      }
    }
  }

  private getSingleNumberLines(): [number, StructureItem, number][] {
    const result: [number, StructureItem, number][] = [];

    for (let i = 0; i < this.structure.length; i++) {
      const x = this.structure[i];

      if (x[0] !== "") continue;
      if (typeof x[1] !== "string") continue;

      const txt = x[1].trim();
      const match = RE_NUM.exec(txt);

      if (match) {
        result.push([i, x, Number.parseInt(match[1], 10)]);
      }
    }

    return result;
  }

  private patchSingleNumberLine(line: [number, StructureItem, number]): void {
    const [index, , num] = line;
    this.structure[index] = ["question", this.questionStub.replace("{}", String(num))];
  }

  private processSingleNumberLines(): void {
    if (this.options.singleNumberLineHandling === "off") {
      return;
    }

    if (this.options.singleNumberLineHandling === "smart") {
      for (const el of this.structure) {
        if (el[0] === "question") return;
      }

      const singleNumberLines = this.getSingleNumberLines();
      if (!singleNumberLines.length) return;

      const frac = this.structure.length / singleNumberLines.length;
      if (!(frac >= 4.0 && frac <= 13.0)) return;

      let prev: [number, StructureItem, number] | null = null;

      for (const line of singleNumberLines) {
        if (!prev || (line[2] - prev[2] <= 3 && line[0] - prev[0] > 1)) {
          this.patchSingleNumberLine(line);
          prev = line;
        }
      }
    } else if (this.options.singleNumberLineHandling === "on") {
      const singleNumberLines = this.getSingleNumberLines();

      for (const line of singleNumberLines) {
        this.patchSingleNumberLine(line);
      }
    }
  }

  private doEnumerateHack(): void {
    let prevNonzeroType: FieldType | null = null;

    for (const el of this.structure) {
      if (typeof el[1] !== "string") continue;

      if (!el[0] && prevNonzeroType === "author" && RE_NUM_START.test(el[1])) {
        el[0] = "question";
        el[1] = el[1].replace(RE_NUM_START, "").trim();
      }

      if (el[0]) {
        prevNonzeroType = el[0];
      }
    }
  }

  parse(text: string): ParsedStructure {
    const regexes = this.regexes;

    // Step 1: Split text and apply regexes
    const sep = text.includes("\r\n") ? "\r\n" : "\n";

    let typographyQuotes = this.options.typographyQuotes;
    let typographyAccents = this.options.typographyAccents;

    if ((text.includes("«") || text.includes("»")) && typographyQuotes === "smart") {
      typographyQuotes = "smart_disable";
    }

    if (text.includes("\u0301") && typographyAccents === "smart") {
      typographyAccents = "smart_disable";
    }

    const fragments: StructureItem[][] = text.split(sep + sep).map((x) =>
      x
        .split(sep)
        .filter((xx) => xx)
        .map((xx) => ["", removeExcessiveWhitespace(xx)] as StructureItem),
    );

    for (const fragment of fragments) {
      this.applyRegexes(fragment);
      const elements = new Set(fragment.map((x) => x[0]));

      if (elements.has("answer") && !fragment[0][0]) {
        fragment[0][0] = "question";
      }
    }

    this.structure = fragments.flat();
    this.doEnumerateHack();

    for (const el of this.structure) {
      if (el[0] === "handout") {
        el[0] = "question";
      }
    }

    this.processSingleNumberLines();

    // Hack for duplet/blitz
    for (let i = 0; i < this.structure.length; i++) {
      const element = this.structure[i];
      if (typeof element[1] !== "string") continue;

      const words = element[1].split(/\s+/);

      if (
        (words.includes("Дуплет.") || words.includes("Блиц.")) &&
        element[0] !== "question" &&
        (i === 0 || this.structure[i - 1][0] !== "question")
      ) {
        element[0] = "question";
      }
    }

    // Step 2: Merge fields
    this.mergeYToX("question", "answer");
    this.mergeToXUntilNextField("answer");
    this.mergeToXUntilNextField("comment");

    // Step 3: Ensure every answer has a question
    let i = 0;

    while (i < this.structure.length) {
      if (
        this.structure[i][0] === "answer" &&
        !["question", "newquestion"].includes(this.structure[i - 1]?.[0] ?? "")
      ) {
        this.structure.splice(i, 0, ["newquestion" as FieldType, ""]);
        i = 0;
      }
      i += 1;
    }

    i = 0;

    while (i < this.structure.length - 1) {
      if (
        this.structure[i][0] === "" &&
        this.structure[i + 1][0] === ("newquestion" as FieldType)
      ) {
        this.mergeToNext(i);

        const structVal = this.structure[i][1];
        const itemVal = typeof structVal === "string" ? structVal : "";
        const prevStructVal = this.structure[i - 1]?.[1];
        const prevVal = typeof prevStructVal === "string" ? prevStructVal : "";

        if (
          regexes.number.test(removeExcessiveWhitespace(itemVal)) &&
          !regexes.number.test(removeExcessiveWhitespace(prevVal))
        ) {
          this.structure[i][0] = "question";
          this.structure[i][1] = regexes.number.exec(removeExcessiveWhitespace(itemVal))?.[0]
            ? removeExcessiveWhitespace(itemVal).replace(regexes.number, "")
            : itemVal;

          const num = regexes.number.exec(removeExcessiveWhitespace(itemVal));
          if (num) {
            this.structure.splice(i, 0, ["number" as FieldType, num[0].replace(/[^\d]/g, "")]);
          }

          i = 0;
        }
      }
      i += 1;
    }

    for (const element of this.structure) {
      if (element[0] === ("newquestion" as FieldType)) {
        element[0] = "question";
      }
    }

    this.dirtyMergeToXUntilNextField("source");

    for (let idx = 0; idx < this.structure.length; idx++) {
      const element = this.structure[idx];

      if (
        element[0] === "author" &&
        typeof element[1] === "string" &&
        new RegExp(`^${regexes.author.source}$`).test(removeExcessiveWhitespace(element[1])) &&
        idx + 1 < this.structure.length
      ) {
        this.mergeToPrevious(idx + 1);
      }
    }

    this.mergeToXUntilNextField("zachet");
    this.mergeToXUntilNextField("nezachet");

    // Step 4: Mark remaining empty fields as meta
    this.structure = this.structure.filter(
      (x) => !(x[0] === "" && (typeof x[1] !== "string" || removeExcessiveWhitespace(x[1]) === "")),
    );

    if (
      this.structure[0]?.[0] === "" &&
      typeof this.structure[0][1] === "string" &&
      regexes.number.test(removeExcessiveWhitespace(this.structure[0][1]))
    ) {
      this.mergeToNext(0);
    }

    let idx = 0;

    while (idx < this.structure.length) {
      const element = this.structure[idx];

      if (element[0] === "") {
        element[0] = "meta";
      }

      if (element[0] in regexes && !["tour", "tourrev", "editor"].includes(element[0])) {
        if (element[0] === "question" && typeof element[1] === "string") {
          const match = regexes.question.exec(element[1]);

          if (match?.groups?.number) {
            this.structure.splice(idx, 0, ["number" as FieldType, match.groups.number]);
            idx += 1;
          }

          if (
            (!match || !match.groups?.number) &&
            (element[1].toLowerCase().includes("нулевой вопрос") ||
              element[1].toLowerCase().includes("разминочный вопрос"))
          ) {
            this.structure.splice(idx, 0, ["number" as FieldType, "0"]);
            idx += 1;
          }

          const lines = element[1].split(SEP);

          for (let j = 0; j < lines.length; j++) {
            if (regexes.question.test(lines[j])) {
              lines[j] = lines[j].replace(regexes.question, "");
            }
          }

          element[1] = lines.filter((x) => x.trim()).join(SEP);
        } else if (typeof element[1] === "string") {
          const regex = regexes[element[0] as keyof ParserRegexes];
          element[1] = element[1].replace(regex, "");
        }

        if (typeof element[1] === "string" && element[1].startsWith(SEP)) {
          element[1] = element[1].slice(SEP.length);
        }
      }

      idx += 1;
    }

    // Step 5: Prettify
    for (let idx = 0; idx < this.structure.length; idx++) {
      const element = this.structure[idx];

      // Remove question numbers
      if (element[0] === "question" && typeof element[1] === "string") {
        const match = regexes.question.exec(element[1]);

        if (match?.groups?.number) {
          this.structure.splice(idx, 0, ["number" as FieldType, match.groups.number]);
        }

        element[1] = element[1].replace(regexes.question, "");
      }

      // Detect inner lists
      if (typeof element[1] === "string") {
        const matches = [...element[1].matchAll(/(\s+|^)(\d+)[.)]\s*(?!\d)/gu)];

        if (matches.length > 1) {
          const sortedUp = matches.sort((a, b) => Number(a[2]) - Number(b[2]));
          let j = 0;
          const listCandidate: [number, string, number][] = [];

          while (j === Number(sortedUp[j]?.[2]) - 1) {
            listCandidate.push([j + 1, sortedUp[j][0], sortedUp[j].index ?? 0]);

            if (j + 1 < sortedUp.length) {
              j += 1;
            } else {
              break;
            }
          }

          if (listCandidate.length > 1) {
            if (
              element[0] !== "question" ||
              (element[0] === "question" &&
                (element[1].toLowerCase().includes("дуплет") ||
                  element[1].toLowerCase().includes("блиц")))
            ) {
              const indices = listCandidate.map((x) => x[2]);
              const parts = partition(element[1], indices);

              for (let lc = 0; lc < listCandidate.length; lc++) {
                parts[lc + 1] = parts[lc + 1].replace(listCandidate[lc][1], "");
              }

              element[1] = parts[0] !== "" ? [parts[0], parts.slice(1)] : parts.slice(1);
            }
          }
        }

        // Turn source into list if necessary
        if (
          element[0] === "source" &&
          typeof element[1] === "string" &&
          element[1].split(/\r?\n/).length > 1
        ) {
          element[1] = element[1]
            .split(/\r?\n/)
            .map((x) => removeExcessiveWhitespace(x).replace(regexes.number, ""));
        }
      }

      // Apply typography
      if (element[0] !== "date") {
        element[1] = recursiveTypography(element[1], {
          accents: typographyAccents,
          dashes: this.options.typographyDashes,
          quotes: typographyQuotes,
          wsp: this.options.typographyWhitespace,
          percent: this.options.typographyPercent,
        }) as FieldValue;
      }
    }

    // Step 6: Pack questions into dicts
    const finalStructure: ParsedStructure = [];
    let currentQuestion: Question = {} as Question;

    for (const element of this.structure) {
      if (
        ["number", "tour", "tourrev", "question", "meta", "editor"].includes(element[0]) &&
        "question" in currentQuestion
      ) {
        if (this.defaultAuthor && !("author" in currentQuestion)) {
          currentQuestion.author = this.defaultAuthor;
        }

        finalStructure.push(["Question", currentQuestion]);
        currentQuestion = {} as Question;
      }

      if (QUESTION_LABELS.includes(element[0] as (typeof QUESTION_LABELS)[number])) {
        const key = element[0] as keyof Question;

        if (key in currentQuestion) {
          // Multiple values for same field
          const existing = currentQuestion[key];
          const newVal = element[1];

          if (Array.isArray(newVal) && typeof existing === "string") {
            (currentQuestion as unknown as Record<string, unknown>)[key] = [existing, ...newVal];
          } else if (typeof newVal === "string" && Array.isArray(existing)) {
            (existing as string[]).push(newVal);
          } else if (Array.isArray(newVal) && Array.isArray(existing)) {
            (existing as string[]).push(...(newVal as string[]));
          } else if (typeof newVal === "string" && typeof existing === "string") {
            (currentQuestion as unknown as Record<string, unknown>)[key] = existing + SEP + newVal;
          }
        } else {
          (currentQuestion as unknown as Record<string, unknown>)[key] = element[1];
        }
      } else {
        finalStructure.push([element[0], element[1]]);
      }
    }

    if (Object.keys(currentQuestion).length > 0) {
      if (this.defaultAuthor && !("author" in currentQuestion)) {
        currentQuestion.author = this.defaultAuthor;
      }

      finalStructure.push(["Question", currentQuestion]);
    }

    // Step 7: Final processing
    try {
      const fq = finalStructure.findIndex((x) => x[0] === "Question");

      if (fq >= 0) {
        const headerlabels = finalStructure.slice(0, fq).map((x) => x[0]);
        let dateDefined = headerlabels.includes("date");
        const headingDefined =
          headerlabels.includes("heading") || headerlabels.includes("ljheading");

        if (!headingDefined && finalStructure[0]?.[0] === "meta") {
          finalStructure[0][0] = "heading";
          finalStructure.splice(0, 0, ["ljheading", finalStructure[0][1]]);
        }

        let j = 0;

        while (!dateDefined && j < fq) {
          const elem = finalStructure[j];
          if (typeof elem[1] !== "string") {
            j += 1;
            continue;
          }

          const match2 = regexes.date2.exec(elem[1]);

          if (match2 && match2[0].length >= elem[1].length / 10) {
            elem[0] = "date";
            dateDefined = true;
            break;
          }

          const match = searchForDate(elem[1]);

          if (match && match[0].length >= elem[1].length / 10) {
            elem[0] = "date";
            dateDefined = true;
            break;
          }

          j += 1;
        }
      }
    } catch {
      // Ignore errors
    }

    let tourCnt = 0;

    for (const element of finalStructure) {
      if (element[0] === "Question") {
        this.postprocessQuestion(element[1] as Question);
      } else if (element[0] === "tour" && TOUR_NUMBERS_AS_WORDS[tourCnt]) {
        element[1] = `${TOUR_NUMBERS_AS_WORDS[tourCnt]} тур`;
        tourCnt += 1;
      }
    }

    return finalStructure;
  }
}

export function chgkParse(
  text: string,
  options?: ParserOptions,
  defaultAuthor = "",
): ParsedStructure {
  const parser = new ChgkParser(options, defaultAuthor);
  return parser.parse(text);
}

export * from "./regexes";
export * from "./types";
