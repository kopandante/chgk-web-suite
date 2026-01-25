// TXT file parser for CHGK questions
// Supports Russian and English field labels with multiline values

export interface TxtQuestion {
  question: string;
  answer: string | null;
  zachet: string | null;
  nezachet: string | null;
  comment: string | null;
  source: string | null;
  author: string | null;
  handout: string | null;
}

// Field patterns with Russian and English labels
// Order matters: more specific patterns first
const FIELD_PATTERNS: Array<{
  field: keyof TxtQuestion;
  pattern: RegExp;
}> = [
  // Handout / Razdatka (colon/period required)
  {
    field: "handout",
    pattern: /^(?:Раздатка|Раздаточный материал|Handout)\s*[:.]\s*/i,
  },
  // Question (colon/period required, optional number)
  {
    field: "question",
    pattern: /^(?:Вопрос|Question)\s*(?:\d+)?\s*[:.]\s*/i,
  },
  // Answer (colon/period required)
  {
    field: "answer",
    pattern: /^(?:Ответ|Answer)\s*[:.]\s*/i,
  },
  // Accept / Zachet (colon/period required)
  {
    field: "zachet",
    pattern: /^(?:Зачёт|Зачет|Accept)\s*[:.]\s*/i,
  },
  // Reject / Nezachet (colon/period required)
  {
    field: "nezachet",
    pattern: /^(?:Незачёт|Незачет|Reject)\s*[:.]\s*/i,
  },
  // Comment (colon/period required)
  {
    field: "comment",
    pattern: /^(?:Комментарий|Комм|Comment)\s*[:.]\s*/i,
  },
  // Source (colon/period required)
  {
    field: "source",
    pattern: /^(?:Источник|Source)\s*[:.]\s*/i,
  },
  // Author (colon/period required)
  {
    field: "author",
    pattern: /^(?:Автор|Author)\s*[:.]\s*/i,
  },
];

// Question separator patterns
const SEPARATOR_PATTERNS = [
  /^-{3,}$/, // ---
  /^={3,}$/, // ===
  /^_{3,}$/, // ___
  /^\*{3,}$/, // ***
];

/**
 * Check if a line is a question separator
 */
function isSeparator(line: string): boolean {
  const trimmed = line.trim();

  // Empty line counts as separator only in context (handled elsewhere)
  if (trimmed === "") {
    return false;
  }

  return SEPARATOR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Check if a line starts a new field and extract field info
 */
function matchField(line: string): { field: keyof TxtQuestion; value: string } | null {
  for (const { field, pattern } of FIELD_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return {
        field,
        value: line.slice(match[0].length).trim(),
      };
    }
  }
  return null;
}

/**
 * Create an empty question object
 */
function createEmptyQuestion(): TxtQuestion {
  return {
    question: "",
    answer: null,
    zachet: null,
    nezachet: null,
    comment: null,
    source: null,
    author: null,
    handout: null,
  };
}

/**
 * Check if a question has any meaningful content
 */
function isValidQuestion(q: TxtQuestion): boolean {
  return q.question.trim().length > 0 || q.answer !== null;
}

/**
 * Parse TXT file content into array of questions
 *
 * Supported field labels (case-insensitive):
 * - Question / Vopros
 * - Answer / Otvet
 * - Accept / Zachet
 * - Reject / Nezachet
 * - Comment / Kommentariy
 * - Source / Istochnik
 * - Author / Avtor
 * - Handout / Razdatka
 *
 * Questions are separated by:
 * - Double empty lines
 * - Lines starting with "Vopros:" / "Question:"
 * - Separator lines: ---, ===, ___, ***
 *
 * @param content - Raw TXT file content
 * @returns Array of parsed questions
 */
export function parseTxtFile(content: string): TxtQuestion[] {
  const questions: TxtQuestion[] = [];
  const lines = content.split(/\r?\n/);

  let currentQuestion = createEmptyQuestion();
  let currentField: keyof TxtQuestion | null = null;
  let emptyLineCount = 0;
  let hasStartedQuestion = false;

  function saveCurrentQuestion(): void {
    if (isValidQuestion(currentQuestion)) {
      // Trim all string fields
      currentQuestion.question = currentQuestion.question.trim();
      if (currentQuestion.answer) currentQuestion.answer = currentQuestion.answer.trim();
      if (currentQuestion.zachet) currentQuestion.zachet = currentQuestion.zachet.trim();
      if (currentQuestion.nezachet) currentQuestion.nezachet = currentQuestion.nezachet.trim();
      if (currentQuestion.comment) currentQuestion.comment = currentQuestion.comment.trim();
      if (currentQuestion.source) currentQuestion.source = currentQuestion.source.trim();
      if (currentQuestion.author) currentQuestion.author = currentQuestion.author.trim();
      if (currentQuestion.handout) currentQuestion.handout = currentQuestion.handout.trim();

      questions.push(currentQuestion);
    }
    currentQuestion = createEmptyQuestion();
    currentField = null;
    hasStartedQuestion = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for explicit separators (---, ===, etc.)
    if (isSeparator(trimmedLine)) {
      saveCurrentQuestion();
      emptyLineCount = 0;
      continue;
    }

    // Track empty lines
    if (trimmedLine === "") {
      emptyLineCount++;

      // Two or more empty lines = question separator
      if (emptyLineCount >= 2 && hasStartedQuestion) {
        saveCurrentQuestion();
      }

      // Add empty line to multiline field (single empty line)
      if (emptyLineCount === 1 && currentField !== null) {
        const currentValue = currentQuestion[currentField];
        if (currentValue !== null) {
          currentQuestion[currentField] = (currentValue + "\n") as string;
        }
      }

      continue;
    }

    // Reset empty line counter on non-empty line
    emptyLineCount = 0;

    // Check if line starts a new field
    const fieldMatch = matchField(trimmedLine);

    if (fieldMatch) {
      // Check if this is a new question
      if (fieldMatch.field === "question" && hasStartedQuestion) {
        saveCurrentQuestion();
      }

      currentField = fieldMatch.field;
      hasStartedQuestion = true;

      // Set the field value
      if (fieldMatch.field === "question") {
        currentQuestion.question = fieldMatch.value;
      } else {
        currentQuestion[fieldMatch.field] = fieldMatch.value || "";
      }

      continue;
    }

    // Line doesn't match any field pattern
    if (currentField !== null) {
      // Append to current field (multiline value)
      const currentValue = currentQuestion[currentField];
      if (currentValue !== null) {
        currentQuestion[currentField] = ((currentValue ? currentValue + "\n" : "") +
          trimmedLine) as string;
      }
    } else if (!hasStartedQuestion) {
      // If no field started yet, treat as question text
      currentQuestion.question += (currentQuestion.question ? "\n" : "") + trimmedLine;
      hasStartedQuestion = true;
      currentField = "question";
    }
  }

  // Save last question
  saveCurrentQuestion();

  return questions;
}

/**
 * Parse TXT content with less strict format (no field labels required)
 * Assumes first paragraph is question, second is answer
 *
 * @param content - Raw TXT file content
 * @returns Array of parsed questions
 */
export function parseTxtSimple(content: string): TxtQuestion[] {
  const questions: TxtQuestion[] = [];
  // Split by double newlines or separator lines (---, ===, ___, ***)
  // First normalize line separators, then split
  const normalized = content.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n{2,}|\n-{3,}\n|\n={3,}\n|\n_{3,}\n|\n\*{3,}\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Skip blocks that are just separators
    if (/^[-=_*]{3,}$/.test(trimmed)) continue;

    const lines = trimmed.split(/\n/);
    const question = createEmptyQuestion();

    // Try to parse with field labels first
    let currentField: keyof TxtQuestion = "question";

    for (const line of lines) {
      const fieldMatch = matchField(line);

      if (fieldMatch) {
        currentField = fieldMatch.field;
        if (fieldMatch.field === "question") {
          question.question = fieldMatch.value;
        } else {
          question[fieldMatch.field] = fieldMatch.value;
        }
      } else {
        // Append to current field
        if (currentField === "question") {
          question.question += (question.question ? "\n" : "") + line.trim();
        } else {
          const currentValue = question[currentField];
          question[currentField] = ((currentValue ? currentValue + "\n" : "") +
            line.trim()) as string;
        }
      }
    }

    if (isValidQuestion(question)) {
      // Trim all fields
      question.question = question.question.trim();
      if (question.answer) question.answer = question.answer.trim();
      if (question.zachet) question.zachet = question.zachet.trim();
      if (question.nezachet) question.nezachet = question.nezachet.trim();
      if (question.comment) question.comment = question.comment.trim();
      if (question.source) question.source = question.source.trim();
      if (question.author) question.author = question.author.trim();
      if (question.handout) question.handout = question.handout.trim();

      questions.push(question);
    }
  }

  return questions;
}
