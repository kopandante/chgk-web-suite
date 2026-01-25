// PPTX export using pptxgenjs library
// Dynamic import to avoid SSR issues with Node.js modules

import type { Image, Package, Question, Tour } from "@/lib/db/schema";

export interface PptxExportOptions {
  // Slide dimensions
  slideWidth?: number; // in inches
  slideHeight?: number;
  // Colors
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  // Font settings
  fontFamily?: string;
  questionFontSize?: number;
  answerFontSize?: number;
  // Layout
  showQuestionNumber?: boolean;
  separateAnswerSlides?: boolean;
  includeImages?: boolean;
}

const DEFAULT_OPTIONS: Required<PptxExportOptions> = {
  slideWidth: 10,
  slideHeight: 5.625, // 16:9 ratio
  backgroundColor: "FFFFFF",
  textColor: "000000",
  accentColor: "2563EB",
  fontFamily: "Arial",
  questionFontSize: 24,
  answerFontSize: 20,
  showQuestionNumber: true,
  separateAnswerSlides: true,
  includeImages: true,
};

// Remove image placeholders from text
function stripImagePlaceholders(text: string): string {
  return text.replace(/\(img\s+[A-Za-z0-9_()-]+\.[a-z]+\)/gi, "").trim();
}

// Restore underscores from parser placeholder
function restoreUnderscores(text: string): string {
  return text.replace(/\$\$UNDERSCORE\$\$/g, "_");
}

// Clean text for presentation
function cleanText(text: string): string {
  return restoreUnderscores(stripImagePlaceholders(text));
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

export async function exportToPptx(
  pkg: Package,
  questions: Question[],
  tours: Tour[],
  images: Image[],
  userOptions: PptxExportOptions = {},
): Promise<Blob> {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  // Create image map for quick lookup
  const imageMap = new Map<string, Image>();
  for (const img of images) {
    imageMap.set(img.id, img);
  }

  // Dynamic import pptxgenjs to avoid SSR issues
  const PptxGenJS = (await import("pptxgenjs")).default;

  // Create presentation
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "CUSTOM", width: options.slideWidth, height: options.slideHeight });
  pptx.layout = "CUSTOM";
  pptx.title = pkg.title;
  pptx.author = pkg.editor || "CHGK-Web";

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: options.backgroundColor };
  titleSlide.addText(pkg.title, {
    x: 0.5,
    y: "40%",
    w: "90%",
    h: 1,
    fontSize: 36,
    fontFace: options.fontFamily,
    color: options.textColor,
    align: "center",
    bold: true,
  });

  if (pkg.editor) {
    titleSlide.addText(pkg.editor, {
      x: 0.5,
      y: "55%",
      w: "90%",
      h: 0.5,
      fontSize: 18,
      fontFace: options.fontFamily,
      color: options.accentColor,
      align: "center",
      italic: true,
    });
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

    // Tour title slide
    if (tour) {
      const tourSlide = pptx.addSlide();
      tourSlide.background = { color: options.accentColor };
      tourSlide.addText(tour.title || `Тур ${tourIndex + 1}`, {
        x: 0.5,
        y: "40%",
        w: "90%",
        h: 1,
        fontSize: 32,
        fontFace: options.fontFamily,
        color: "FFFFFF",
        align: "center",
        bold: true,
      });
      tourIndex++;
    }

    // Question slides
    for (let i = 0; i < tourQuestions.length; i++) {
      const question = tourQuestions[i];
      const questionNumber = question.number ?? i + 1;

      // Question slide
      const qSlide = pptx.addSlide();
      qSlide.background = { color: options.backgroundColor };

      // Question number
      if (options.showQuestionNumber) {
        qSlide.addText(`Вопрос ${questionNumber}`, {
          x: 0.5,
          y: 0.3,
          w: "90%",
          h: 0.5,
          fontSize: 16,
          fontFace: options.fontFamily,
          color: options.accentColor,
          bold: true,
        });
      }

      // Handout
      let yPosition = options.showQuestionNumber ? 0.9 : 0.5;
      if (question.handout) {
        qSlide.addText(`Раздатка: ${cleanText(question.handout)}`, {
          x: 0.5,
          y: yPosition,
          w: "90%",
          h: 0.6,
          fontSize: 14,
          fontFace: options.fontFamily,
          color: options.textColor,
          italic: true,
        });
        yPosition += 0.7;
      }

      // Question text
      qSlide.addText(cleanText(question.question), {
        x: 0.5,
        y: yPosition,
        w: "90%",
        h: options.slideHeight - yPosition - 0.5,
        fontSize: options.questionFontSize,
        fontFace: options.fontFamily,
        color: options.textColor,
        valign: "top",
      });

      // Images in question
      if (options.includeImages) {
        const questionImages = extractImageIds(question.question);
        for (const imgId of questionImages) {
          const img = imageMap.get(imgId);
          if (img) {
            try {
              const dataUrl = `data:${img.content_type};base64,${img.data}`;

              qSlide.addImage({
                data: dataUrl,
                x: 6,
                y: 1.5,
                w: 3.5,
                h: 2.5,
              });
            } catch {
              // Skip image if it fails
            }
          }
        }
      }

      // Answer slide (if separate)
      if (options.separateAnswerSlides && question.answer) {
        const aSlide = pptx.addSlide();
        aSlide.background = { color: options.backgroundColor };

        // Question number reference
        if (options.showQuestionNumber) {
          aSlide.addText(`Ответ на вопрос ${questionNumber}`, {
            x: 0.5,
            y: 0.3,
            w: "90%",
            h: 0.5,
            fontSize: 16,
            fontFace: options.fontFamily,
            color: options.accentColor,
            bold: true,
          });
        }

        // Answer
        aSlide.addText(cleanText(question.answer), {
          x: 0.5,
          y: 1,
          w: "90%",
          h: 1.5,
          fontSize: options.answerFontSize,
          fontFace: options.fontFamily,
          color: options.textColor,
          bold: true,
        });

        // Zachet
        let answerY = 2.6;
        if (question.zachet) {
          aSlide.addText(`Зачет: ${cleanText(question.zachet)}`, {
            x: 0.5,
            y: answerY,
            w: "90%",
            h: 0.5,
            fontSize: 14,
            fontFace: options.fontFamily,
            color: options.textColor,
            italic: true,
          });
          answerY += 0.5;
        }

        // Comment
        if (question.comment) {
          aSlide.addText(`Комментарий: ${cleanText(question.comment)}`, {
            x: 0.5,
            y: answerY,
            w: "90%",
            h: 0.8,
            fontSize: 12,
            fontFace: options.fontFamily,
            color: options.textColor,
          });
          answerY += 0.8;
        }

        // Source
        if (question.source) {
          aSlide.addText(`Источник: ${cleanText(question.source)}`, {
            x: 0.5,
            y: answerY,
            w: "90%",
            h: 0.5,
            fontSize: 10,
            fontFace: options.fontFamily,
            color: "666666",
          });
          answerY += 0.5;
        }

        // Author
        if (question.author) {
          aSlide.addText(`Автор: ${cleanText(question.author)}`, {
            x: 0.5,
            y: answerY,
            w: "90%",
            h: 0.4,
            fontSize: 10,
            fontFace: options.fontFamily,
            color: "666666",
          });
        }
      }
    }
  }

  // End slide
  const endSlide = pptx.addSlide();
  endSlide.background = { color: options.accentColor };
  endSlide.addText("Спасибо за игру!", {
    x: 0.5,
    y: "40%",
    w: "90%",
    h: 1,
    fontSize: 36,
    fontFace: options.fontFamily,
    color: "FFFFFF",
    align: "center",
    bold: true,
  });

  // Generate blob
  const data = await pptx.write({ outputType: "blob" });
  return data as Blob;
}
