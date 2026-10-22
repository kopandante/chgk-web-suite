import { describe, expect, test, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import { basename } from "path";
// @ts-ignore - internal function
import { parseDocx, parseDocxToHtml } from "../lib/parser/docx";
import { registerDom } from "./setup";

// Register DOM globals before tests
beforeAll(() => {
  registerDom();
});

// Image placeholder regex - matches format: (img filename.ext)
const IMG_PLACEHOLDER_REGEX = /\(img\s+[A-Za-z0-9_()-]+\.[a-z]+\)/gi;

describe("DOCX images extraction", () => {
  const testFile = "./tests/fixtures/Shkolny_Chemp_Estonii-2014_(48v).docx";
  const testFilename = basename(testFile);
  const testPrefix = testFilename.replace(/\.docx$/i, "");

  test("extracts images from DOCX", async () => {
    const buffer = readFileSync(testFile);

    const { structure, images } = await parseDocx(buffer, undefined, "", testFilename);

    // Should have extracted images
    expect(images.length).toBeGreaterThan(0);
    console.log(`Extracted ${images.length} images`);

    // Check image properties - format should be prefix_001, prefix_002, etc.
    for (const img of images) {
      expect(img.id).toMatch(new RegExp(`^${testPrefix.replace(/[()]/g, "\\$&")}_\\d{3}$`));
      expect(img.data.byteLength).toBeGreaterThan(0);
      expect(img.contentType).toMatch(/^image\/(png|jpeg|gif|webp)$/);
      expect(img.extension).toMatch(/^(png|jpeg|gif|webp)$/);
      console.log(`  - ${img.id}: ${img.contentType}, ${img.data.byteLength} bytes`);
    }
  });

  test("image placeholders are in question text", async () => {
    const buffer = readFileSync(testFile);

    const { structure, images } = await parseDocx(buffer, undefined, "", testFilename);

    // Find questions with image placeholders
    const questionsWithImages: string[] = [];

    for (const [type, value] of structure) {
      if (type === "Question" && typeof value === "object" && value !== null) {
        const q = value as unknown as Record<string, unknown>;
        const allText = Object.values(q)
          .filter((v) => typeof v === "string")
          .join(" ");

        const placeholders = allText.match(IMG_PLACEHOLDER_REGEX) || [];
        if (placeholders.length > 0) {
          questionsWithImages.push(...placeholders);
        }
      }
    }

    // Also check raw structure for any image references
    const structureStr = JSON.stringify(structure);
    const allPlaceholders = structureStr.match(IMG_PLACEHOLDER_REGEX) || [];

    console.log(`Found ${questionsWithImages.length} image placeholders in Question objects`);
    console.log(`Found ${allPlaceholders.length} image placeholders in full structure`);

    if (allPlaceholders.length > 0) {
      console.log(`Sample placeholders: ${allPlaceholders.slice(0, 3).join(", ")}`);
    }

    // Check if images are referenced somewhere
    expect(allPlaceholders.length).toBeGreaterThan(0);
  });

  test("HTML contains image placeholders", async () => {
    const buffer = readFileSync(testFile);

    const { html, images } = await parseDocxToHtml(buffer, testFilename);

    // Check HTML for placeholders
    const placeholders = html.match(IMG_PLACEHOLDER_REGEX) || [];
    console.log(`Found ${placeholders.length} placeholders in HTML`);

    // Check what image-related content is in HTML
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    console.log(`Found ${imgTags.length} remaining img tags in HTML`);
    if (imgTags.length > 0) {
      console.log(`Sample img tag: ${imgTags[0]}`);
    }

    // Check for unreplaced IMGPATH
    const imgPaths = html.match(/IMGPATH\([^)]+\)/gi) || [];
    console.log(`Found ${imgPaths.length} unreplaced IMGPATH references`);

    // Total image references should match
    const totalImageRefs = placeholders.length + imgTags.length;
    console.log(`Total image references: ${totalImageRefs}, Expected: ${images.length}`);

    expect(placeholders.length + imgTags.length).toBe(images.length);
  });

  test("parseDocx preserves placeholders in structure", async () => {
    const buffer = readFileSync(testFile);

    const { structure, images } = await parseDocx(buffer, undefined, "", testFilename);

    // Count placeholders in structure
    const structureStr = JSON.stringify(structure);
    const placeholders = structureStr.match(IMG_PLACEHOLDER_REGEX) || [];

    console.log(`Placeholders in parsed structure: ${placeholders.length}`);
    console.log(`Images extracted: ${images.length}`);

    if (placeholders.length > 0) {
      console.log(`Sample placeholder: ${placeholders[0]}`);
    }

    // All images should have corresponding placeholders
    expect(placeholders.length).toBe(images.length);
  });
});
