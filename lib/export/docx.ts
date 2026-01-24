// DOCX export using docx library

import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import { base64ToUint8Array } from "@/lib/db/client";
import type { Image, Package, Question, Tour } from "@/lib/db/schema";

export interface DocxExportOptions {
  // Spoiler options
  spoilerMode?: "none" | "whiten" | "pagebreak";
  // Include answers
  includeAnswers?: boolean;
  // Font settings
  fontFamily?: string;
  fontSize?: number; // in points
  // Include fields
  includeZachet?: boolean;
  includeComment?: boolean;
  includeSource?: boolean;
  includeAuthor?: boolean;
  includeHandout?: boolean;
}

const DEFAULT_OPTIONS: Required<DocxExportOptions> = {
  spoilerMode: "none",
  includeAnswers: true,
  fontFamily: "Times New Roman",
  fontSize: 12,
  includeZachet: true,
  includeComment: true,
  includeSource: true,
  includeAuthor: true,
  includeHandout: true,
};

// Remove image placeholders from text
function stripImagePlaceholders(text: string): string {
  return text.replace(/\(img\s+[A-Za-z0-9_()-]+\.[a-z]+\)/gi, "").trim();
}

// Restore underscores from parser placeholder
function restoreUnderscores(text: string): string {
  return text.replace(/\$\$UNDERSCORE\$\$/g, "_");
}

// Parse text and create TextRuns
function createTextRuns(
  text: string,
  options: Required<DocxExportOptions>,
  color?: string,
): TextRun[] {
  const cleaned = restoreUnderscores(stripImagePlaceholders(text));
  const lines = cleaned.split("\n");
  const runs: TextRun[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      runs.push(new TextRun({ break: 1 }));
    }
    runs.push(
      new TextRun({
        text: lines[i],
        font: options.fontFamily,
        size: options.fontSize * 2, // docx uses half-points
        color: color,
      }),
    );
  }

  return runs;
}

// Create a labeled paragraph (e.g., "Ответ: ...")
function createLabeledParagraph(
  label: string,
  text: string,
  options: Required<DocxExportOptions>,
  color?: string,
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: options.fontFamily,
        size: options.fontSize * 2,
        color: color,
      }),
      ...createTextRuns(text, options, color),
    ],
    spacing: { after: 120 },
  });
}

export async function exportToDocx(
  pkg: Package,
  questions: Question[],
  tours: Tour[],
  images: Image[],
  userOptions: DocxExportOptions = {},
): Promise<Blob> {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  // Create image map for quick lookup
  const imageMap = new Map<string, Image>();
  for (const img of images) {
    imageMap.set(img.id, img);
  }

  // Build document sections
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: pkg.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );

  // Editor
  if (pkg.editor) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Редактор: ${pkg.editor}`,
            italics: true,
            font: options.fontFamily,
            size: options.fontSize * 2,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );
  }

  // Date
  if (pkg.date) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: pkg.date,
            italics: true,
            font: options.fontFamily,
            size: options.fontSize * 2,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );
  }

  // Group questions by tour
  const tourMap = new Map<string | null, Question[]>();
  for (const q of questions) {
    const key = q.tour_id;
    if (!tourMap.has(key)) {
      tourMap.set(key, []);
    }
    tourMap.get(key)!.push(q);
  }

  // Process each tour
  let tourIndex = 0;
  for (const tour of tours.length > 0 ? tours : [null]) {
    const tourId = tour?.id ?? null;
    const tourQuestions = tourMap.get(tourId) || [];

    if (tourQuestions.length === 0) continue;

    // Tour header
    if (tour) {
      children.push(
        new Paragraph({
          text: tour.title || `Тур ${tourIndex + 1}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
      );
      tourIndex++;
    }

    // Questions
    for (let i = 0; i < tourQuestions.length; i++) {
      const question = tourQuestions[i];
      const questionNumber = question.number ?? i + 1;

      // Question header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Вопрос ${questionNumber}`,
              bold: true,
              font: options.fontFamily,
              size: options.fontSize * 2,
            }),
          ],
          spacing: { before: 300, after: 120 },
        }),
      );

      // Handout
      if (options.includeHandout && question.handout) {
        children.push(createLabeledParagraph("Раздатка", question.handout, options));
      }

      // Question text
      children.push(
        new Paragraph({
          children: createTextRuns(question.question, options),
          spacing: { after: 120 },
        }),
      );

      // Images in question
      const questionImages = extractImageIds(question.question);
      for (const imgId of questionImages) {
        const img = imageMap.get(imgId);
        if (img) {
          try {
            const imageData = base64ToUint8Array(img.data);
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageData,
                    transformation: { width: 400, height: 300 },
                    type: img.content_type.includes("png") ? "png" : "jpg",
                  }),
                ],
                spacing: { after: 120 },
              }),
            );
          } catch {
            // Skip image if it fails to load
          }
        }
      }
    }

    // Answers section
    if (options.includeAnswers) {
      // Page break or spoiler handling
      if (options.spoilerMode === "pagebreak") {
        children.push(
          new Paragraph({
            children: [new PageBreak()],
          }),
        );
      }

      // Answers header
      children.push(
        new Paragraph({
          text: "Ответы",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
      );

      // Answer color for whiten mode
      const answerColor = options.spoilerMode === "whiten" ? "FFFFFF" : undefined;

      for (let i = 0; i < tourQuestions.length; i++) {
        const question = tourQuestions[i];
        const questionNumber = question.number ?? i + 1;

        if (question.answer) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${questionNumber}. `,
                  bold: true,
                  font: options.fontFamily,
                  size: options.fontSize * 2,
                  color: answerColor,
                }),
                ...createTextRuns(question.answer, options, answerColor),
              ],
              spacing: { after: 80 },
            }),
          );
        }

        if (options.includeZachet && question.zachet) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "   Зачет: ",
                  italics: true,
                  font: options.fontFamily,
                  size: (options.fontSize - 1) * 2,
                  color: answerColor,
                }),
                ...createTextRuns(
                  question.zachet,
                  { ...options, fontSize: options.fontSize - 1 },
                  answerColor,
                ),
              ],
              spacing: { after: 40 },
            }),
          );
        }

        if (options.includeComment && question.comment) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "   Комментарий: ",
                  italics: true,
                  font: options.fontFamily,
                  size: (options.fontSize - 1) * 2,
                  color: answerColor,
                }),
                ...createTextRuns(
                  question.comment,
                  { ...options, fontSize: options.fontSize - 1 },
                  answerColor,
                ),
              ],
              spacing: { after: 40 },
            }),
          );
        }

        if (options.includeSource && question.source) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "   Источник: ",
                  italics: true,
                  font: options.fontFamily,
                  size: (options.fontSize - 1) * 2,
                  color: answerColor,
                }),
                ...createTextRuns(
                  question.source,
                  { ...options, fontSize: options.fontSize - 1 },
                  answerColor,
                ),
              ],
              spacing: { after: 40 },
            }),
          );
        }

        if (options.includeAuthor && question.author) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "   Автор: ",
                  italics: true,
                  font: options.fontFamily,
                  size: (options.fontSize - 1) * 2,
                  color: answerColor,
                }),
                ...createTextRuns(
                  question.author,
                  { ...options, fontSize: options.fontSize - 1 },
                  answerColor,
                ),
              ],
              spacing: { after: 80 },
            }),
          );
        }
      }
    }
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  // Generate blob
  return Packer.toBlob(doc);
}

// Extract image IDs from text
function extractImageIds(text: string): string[] {
  const regex = /\(img\s+([A-Za-z0-9_()-]+)\.[a-z]+\)/gi;
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

// Helper to download blob
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
