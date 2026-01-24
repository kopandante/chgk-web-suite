// DOCX parsing utilities using mammoth.js

import mammoth from "mammoth";
import { ChgkParser, type ParsedStructure, type ParserOptions } from "./index";

export interface DocxImage {
  id: string;
  data: ArrayBuffer;
  contentType: string;
  extension: string;
}

export interface ParseDocxResult {
  structure: ParsedStructure;
  images: DocxImage[];
}

function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getExtensionFromContentType(contentType: string): string {
  const mapping: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
  };

  return mapping[contentType] || "png";
}

export async function parseDocxToHtml(
  file: File | ArrayBuffer,
): Promise<{ html: string; images: DocxImage[] }> {
  const images: DocxImage[] = [];
  const imageReplacements: Map<string, string> = new Map();

  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageData = await image.read("base64");
        const contentType = image.contentType;
        const extension = getExtensionFromContentType(contentType);
        const id = generateImageId();

        // Convert base64 to ArrayBuffer
        const binaryString = atob(imageData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        images.push({
          id,
          data: bytes.buffer,
          contentType,
          extension,
        });

        imageReplacements.set(id, `(img ${id}.${extension})`);

        return { src: `IMGPATH(${id})` };
      }),
    },
  );

  let html = result.value;

  // Replace image placeholders
  for (const [id, replacement] of imageReplacements) {
    html = html.replace(`<img src="IMGPATH(${id})" />`, replacement);
  }

  return { html, images };
}

function htmlToText(html: string): string {
  // Replace underscores to preserve them
  let text = html.replace(/_/g, "$$$UNDERSCORE$$$");

  // Remove consecutive strong/em tags
  text = text.replace(/<\/strong><strong>/g, "");
  text = text.replace(/<\/em><em>/g, "");

  // Create a simple HTML parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  // Remove style tags
  for (const style of doc.querySelectorAll("style")) {
    style.remove();
  }

  // Replace br with newlines
  for (const br of doc.querySelectorAll("br")) {
    br.replaceWith("\n");
  }

  // Process paragraphs
  for (const p of doc.querySelectorAll("p")) {
    const content = p.textContent || "";
    if (!content.startsWith("\n")) {
      p.insertBefore(document.createTextNode("\n"), p.firstChild);
    }
    if (!content.endsWith("\n")) {
      p.appendChild(document.createTextNode("\n"));
    }
  }

  // Process headers
  for (const h of doc.querySelectorAll("h1, h2, h3, h4")) {
    const content = h.textContent || "";
    if (!content.startsWith("\n")) {
      h.insertBefore(document.createTextNode("\n"), h.firstChild);
    }
    if (!content.endsWith("\n")) {
      h.appendChild(document.createTextNode("\n"));
    }
  }

  // Process ordered lists
  let olCounter = 0;
  for (const ol of doc.querySelectorAll("ol")) {
    olCounter = 0;
    for (const li of ol.querySelectorAll("li")) {
      olCounter += 1;
      li.insertBefore(document.createTextNode(`${olCounter}. `), li.firstChild);
      li.appendChild(document.createTextNode("\n"));
    }
  }

  // Process unordered lists
  for (const li of doc.querySelectorAll("ul li")) {
    li.insertBefore(document.createTextNode("- "), li.firstChild);
    li.appendChild(document.createTextNode("\n"));
  }

  // Get text content
  let result = doc.body.textContent || "";

  // Cleanup
  result = result
    .replace(/\\-/g, "")
    .replace(/\\\./g, ".")
    .replace(/\( /g, "(")
    .replace(/\[ /g, "[")
    .replace(/ \)/g, ")")
    .replace(/ \]/g, "]")
    .replace(/ :/g, ":")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\$\$\$UNDERSCORE\$\$\$/g, "\\_");

  // Fix bad italic from Word
  result = result.replace(/_ *_/g, "");

  return result;
}

export async function parseDocx(
  file: File | ArrayBuffer,
  options?: ParserOptions,
  defaultAuthor = "",
): Promise<ParseDocxResult> {
  const { html, images } = await parseDocxToHtml(file);

  const text = htmlToText(html);

  const parser = new ChgkParser(options, defaultAuthor);
  const structure = parser.parse(text);

  return { structure, images };
}

// Export to .4s format
export function compose4s(
  structure: ParsedStructure,
  numbersHandling: "default" | "all" = "default",
): string {
  const SEP = "\n";

  const typesMapping: Record<string, string | null> = {
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
    Question: null,
  };

  function formatElement(z: unknown): string {
    if (typeof z === "string") {
      return z.replace(new RegExp(`${SEP}+`, "g"), SEP);
    }

    if (Array.isArray(z)) {
      if (Array.isArray(z[1])) {
        const prefix = z[0].replace(new RegExp(`${SEP}+`, "g"), SEP);
        const items = z[1]
          .map((x: string) => x.replace(new RegExp(`${SEP}+`, "g"), SEP))
          .join(`${SEP}- `);
        return `${prefix}${SEP}- ${items}`;
      }
      const items = z
        .map((x: string) => x.replace(new RegExp(`${SEP}+`, "g"), SEP))
        .join(`${SEP}- `);
      return `${SEP}- ${items}`;
    }

    return "";
  }

  function isZero(s: unknown): boolean {
    return String(s).startsWith("0") || Number.isNaN(Number(s));
  }

  let result = "";
  let firstNumber = true;

  for (const element of structure) {
    if (element[0] in typesMapping && typesMapping[element[0]]) {
      result += typesMapping[element[0]] + formatElement(element[1]) + SEP + SEP;
    } else if (element[0] === "Question" && typeof element[1] === "object" && element[1] !== null) {
      const question = element[1] as unknown as Record<string, unknown>;
      let tmp = "";
      const overrides = (question.overrides as Record<string, string>) || {};

      if ("number" in question) {
        if (numbersHandling === "default") {
          if (isZero(question.number)) {
            tmp += `N ${String(question.number)}${SEP}`;
          } else if (firstNumber && Number(question.number) > 1) {
            tmp += `NN ${String(question.number)}${SEP}`;
          }
        } else if (numbersHandling === "all") {
          tmp += `N ${String(question.number)}${SEP}`;
        }

        if (!isZero(question.number)) {
          firstNumber = false;
        }
      }

      const questionLabels = [
        "handout",
        "question",
        "answer",
        "zachet",
        "nezachet",
        "comment",
        "source",
        "author",
      ];

      for (const label of questionLabels) {
        const overrideLabel = label in overrides ? `!!${overrides[label]} ` : "";

        if (label in question && label in typesMapping) {
          tmp += typesMapping[label] + overrideLabel + formatElement(question[label]) + SEP;
        }
      }

      tmp = tmp.replace(new RegExp(`${SEP}+`, "g"), SEP);
      result += tmp + SEP;
    }
  }

  return result;
}
