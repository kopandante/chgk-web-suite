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

function getExtensionFromContentType(contentType: string): string {
  const mapping: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
  };

  return mapping[contentType] || "png";
}

export async function parseDocxToHtml(
  file: File | ArrayBuffer | Buffer,
  filename = "",
): Promise<{ html: string; images: DocxImage[] }> {
  const images: DocxImage[] = [];
  const imageReplacements: Map<string, string> = new Map();

  // Generate image name prefix from filename (without extension)
  const prefix = filename.replace(/\.docx$/i, "");

  // Counter per extension (like chgksuite's generate_imgname)
  const extensionCounters: Map<string, number> = new Map();

  // Determine input type for mammoth
  let mammothInput: { arrayBuffer: ArrayBuffer } | { buffer: Buffer };
  if (file instanceof File) {
    mammothInput = { arrayBuffer: await file.arrayBuffer() };
  } else if (Buffer.isBuffer(file)) {
    mammothInput = { buffer: file };
  } else {
    mammothInput = { arrayBuffer: file };
  }

  const result = await mammoth.convertToHtml(
    mammothInput,
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageData = await image.read("base64");
        const contentType = image.contentType;
        const extension = getExtensionFromContentType(contentType);

        // Generate sequential image ID per extension like chgksuite: prefix_001.ext
        const counter = (extensionCounters.get(extension) || 0) + 1;
        extensionCounters.set(extension, counter);
        const id = prefix ? `${prefix}_${String(counter).padStart(3, "0")}` : `img_${String(counter).padStart(3, "0")}`;

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

        imageReplacements.set(`${id}.${extension}`, `(img ${id}.${extension})`);

        return { src: `IMGPATH(${id}.${extension})` };
      }),
    },
  );

  let html = result.value;

  // Replace image placeholders - handle img tags with any attributes
  for (const [idWithExt, replacement] of imageReplacements) {
    // Escape special regex characters in ID (especially parentheses)
    const escapedId = idWithExt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match img tags with IMGPATH(id.ext) in src, regardless of other attributes
    const imgRegex = new RegExp(`<img[^>]*src="IMGPATH\\(${escapedId}\\)"[^>]*\\/?>`, "gi");
    html = html.replace(imgRegex, replacement);
  }

  return { html, images };
}

function htmlToText(html: string): string {
  // Protect image placeholders from underscore escaping
  // Use non-greedy match to handle filenames with parentheses like (48v)
  const imagePlaceholders: string[] = [];
  let text = html.replace(/\(img\s+.+?\.[a-z]+\)/gi, (match) => {
    imagePlaceholders.push(match);
    return `IMGPLACEHOLDER${imagePlaceholders.length - 1}ENDIMG`;
  });

  // Replace underscores to preserve them (use marker without $ to avoid regex replacement issues)
  text = text.replace(/_/g, "UNDERSCORE_MARKER");

  // Protect &amp; from being decoded by DOMParser
  text = text.replace(/&amp;/g, "AMPERSAND_MARKER");

  // Remove consecutive strong/em tags
  text = text.replace(/<\/strong><strong>/g, "");
  text = text.replace(/<\/em><em>/g, "");

  // Create a simple HTML parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  // Preserve formatting: add markdown markers around em/strong/i/b tags
  for (const tag of doc.querySelectorAll("em, i")) {
    tag.insertBefore(document.createTextNode("_"), tag.firstChild);
    tag.appendChild(document.createTextNode("_"));
  }
  for (const tag of doc.querySelectorAll("strong, b")) {
    tag.insertBefore(document.createTextNode("__"), tag.firstChild);
    tag.appendChild(document.createTextNode("__"));
  }

  // Process links: add URL to text like chgksuite
  for (const link of doc.querySelectorAll("a")) {
    const href = link.getAttribute("href");
    const linkText = link.textContent || "";

    if (linkText.startsWith("http")) {
      // Text is already a URL, just unwrap
      continue;
    }

    if (href && href.startsWith("http") && !href.includes(linkText.trim())) {
      // Add URL in parentheses after text
      link.textContent = `${linkText} (${href})`;
    }
  }

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
    .replace(/UNDERSCORE_MARKER/g, "\\_")
    .replace(/AMPERSAND_MARKER/g, "&amp;");

  // Restore image placeholders (they were protected from underscore escaping)
  result = result.replace(/IMGPLACEHOLDER(\d+)ENDIMG/g, (_, index) => {
    return imagePlaceholders[parseInt(index, 10)];
  });

  // Fix bad italic from Word
  result = result.replace(/_ *_/g, "");

  return result;
}

export async function parseDocx(
  file: File | ArrayBuffer | Buffer,
  options?: ParserOptions,
  defaultAuthor = "",
  filename = "",
): Promise<ParseDocxResult> {
  // Get filename from File object if not provided
  const docxFilename = filename || (file instanceof File ? file.name : "");
  const { html, images } = await parseDocxToHtml(file, docxFilename);

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
