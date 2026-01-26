"use client";

import { createContext, Fragment, useContext } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { isStructuredField, type QuestionFieldValue } from "@/lib/db/encrypted-client";
import { QuestionImageByFilename } from "./question-image";

// Context to pass questionId through the component tree
const QuestionContext = createContext<Id<"questions"> | null>(null);

// Placeholder for escaped underscores (using a string that won't appear in text)
const UNDERSCORE_PLACEHOLDER = "%%UNDERSCORE%%";

/**
 * Parse formatting markers and return array of styled runs
 * Supports: _italic_, __bold__, ___underline___, ~strike~
 */
function parseFormatting(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let keyCounter = 0;

  // Pattern for formatting: ___text___, __text__, _text_, ~text~
  // Order matters: longer patterns first
  const formatRegex = /(___|__|_|~)(.+?)\1/g;

  let lastIndex = 0;
  const matches = text.matchAll(formatRegex);

  for (const match of matches) {
    // Add text before the match
    if (match.index !== undefined && match.index > lastIndex) {
      result.push(
        <Fragment key={`plain-${keyCounter++}`}>{text.slice(lastIndex, match.index)}</Fragment>,
      );
    }

    const marker = match[1];
    const content = match[2];

    // Recursively parse nested formatting
    const children = parseFormatting(content);

    if (marker === "___") {
      result.push(
        <span key={`underline-${keyCounter++}`} className="underline">
          {children}
        </span>,
      );
    } else if (marker === "__") {
      result.push(<strong key={`bold-${keyCounter++}`}>{children}</strong>);
    } else if (marker === "_") {
      result.push(<em key={`italic-${keyCounter++}`}>{children}</em>);
    } else if (marker === "~") {
      result.push(
        <span key={`strike-${keyCounter++}`} className="line-through">
          {children}
        </span>,
      );
    }

    if (match.index !== undefined) {
      lastIndex = match.index + match[0].length;
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(<Fragment key={`plain-${keyCounter++}`}>{text.slice(lastIndex)}</Fragment>);
  }

  return result.length > 0 ? result : [<Fragment key="empty">{text}</Fragment>];
}

/**
 * Restore escaped underscores with placeholder
 */
function protectUnderscores(text: string): string {
  return text.replace(/\\_/g, UNDERSCORE_PLACEHOLDER);
}

/**
 * Restore placeholder back to underscores
 */
function restoreUnderscores(text: string): string {
  return text.split(UNDERSCORE_PLACEHOLDER).join("_");
}

/**
 * Image placeholder component that uses context to get questionId
 */
function ImagePlaceholder({ filename, keyId }: { filename: string; keyId: string }) {
  const questionId = useContext(QuestionContext);

  if (!questionId) {
    return (
      <div className="bg-muted/50 rounded p-4 text-muted-foreground text-sm my-2 max-w-md">
        Изображение: {filename}
      </div>
    );
  }

  return (
    <QuestionImageByFilename
      key={keyId}
      questionId={questionId}
      filename={filename}
      className="my-2 max-w-md"
    />
  );
}

/**
 * Parse text and convert URLs to clickable links, images to QuestionImage components
 */
function parseTextWithLinksAndImages(text: string): React.ReactNode[] {
  // First, protect escaped underscores
  const protectedText = protectUnderscores(text);

  const result: React.ReactNode[] = [];
  let keyCounter = 0;

  // Combined pattern for URLs and images
  const combinedRegex = /(https?:\/\/[^\s\n]+)|\(img\s+([A-Za-z0-9_()-]+)\.[a-z]+\)/gi;

  let lastIndex = 0;
  const matches = protectedText.matchAll(combinedRegex);

  for (const match of matches) {
    if (match.index === undefined) continue;

    // Add text before the match (with formatting)
    if (match.index > lastIndex) {
      const segment = protectedText.slice(lastIndex, match.index);
      const formatted = parseFormatting(restoreUnderscores(segment));
      result.push(<Fragment key={`seg-${keyCounter++}`}>{formatted}</Fragment>);
    }

    if (match[1]) {
      // URL match
      result.push(
        <a
          key={`url-${keyCounter++}`}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:no-underline break-all"
        >
          {match[1]}
        </a>,
      );
    } else if (match[2]) {
      // Image placeholder match - use filename to look up image
      result.push(
        <ImagePlaceholder
          key={`img-${keyCounter++}`}
          filename={match[2]}
          keyId={`img-${keyCounter}`}
        />,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text (with formatting)
  if (lastIndex < protectedText.length) {
    const segment = protectedText.slice(lastIndex);
    const formatted = parseFormatting(restoreUnderscores(segment));
    result.push(<Fragment key={`seg-${keyCounter++}`}>{formatted}</Fragment>);
  }

  if (result.length === 0) {
    const formatted = parseFormatting(restoreUnderscores(protectedText));
    return formatted;
  }

  return result;
}

interface FormatTextProps {
  text: string | null | undefined;
  className?: string;
  questionId?: Id<"questions">;
}

/**
 * Check if line is a numbered list item (e.g., "1. Text" or "2) Text")
 */
function parseNumberedListItem(line: string): { number: number; text: string } | null {
  const match = line.match(/^(\d+)[.)]\s+(.+)$/);
  if (match) {
    return { number: Number.parseInt(match[1], 10), text: match[2] };
  }
  return null;
}

/**
 * Format text: apply formatting (_italic_, __bold__, etc.), make URLs clickable, render images
 * Handles duplets/blitzes with numbered sub-questions
 */
export function FormatText({ text, className, questionId }: FormatTextProps) {
  if (!text) return null;

  // Split by newlines and process each line
  const lines = text.split("\n");

  // Check if this looks like a duplet/blitz (has numbered items after header)
  const isDupletOrBlitz =
    lines.length > 1 &&
    (lines[0].toLowerCase().includes("дуплет") || lines[0].toLowerCase().includes("блиц"));

  // Check if all lines are numbered (for answers)
  const allNumbered = lines.length > 1 && lines.every((line) => parseNumberedListItem(line));

  const content = (
    <span className={className}>
      {lines.map((line, lineIndex) => {
        const listItem = parseNumberedListItem(line);

        // Format numbered items with indent (for duplets/blitzes or numbered answers)
        if ((isDupletOrBlitz || allNumbered) && listItem) {
          return (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              <span className={allNumbered ? "" : "inline-block ml-4"}>
                <span className="text-muted-foreground mr-1">{listItem.number}.</span>
                {parseTextWithLinksAndImages(listItem.text)}
              </span>
            </Fragment>
          );
        }

        return (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            {parseTextWithLinksAndImages(line)}
          </Fragment>
        );
      })}
    </span>
  );

  // Wrap with context if questionId is provided
  if (questionId) {
    return <QuestionContext.Provider value={questionId}>{content}</QuestionContext.Provider>;
  }

  return content;
}

interface FormatSourceProps {
  source: string | null | undefined;
  questionId?: Id<"questions">;
}

/**
 * Format source field - handles arrays stored as newline-separated strings
 */
export function FormatSource({ source, questionId }: FormatSourceProps) {
  if (!source) return null;

  const lines = source.split("\n").filter((line) => line.trim());

  if (lines.length === 1) {
    return <FormatText text={lines[0]} questionId={questionId} />;
  }

  return (
    <ul className="list-disc list-inside space-y-1">
      {lines.map((line, index) => (
        <li key={index}>
          <FormatText text={line} questionId={questionId} />
        </li>
      ))}
    </ul>
  );
}

interface FormatFieldProps {
  value: QuestionFieldValue | null | undefined;
  className?: string;
  questionId?: Id<"questions">;
}

/**
 * Format a QuestionFieldValue (string or structured field)
 * Handles both regular text and duplet/blitz structures
 */
export function FormatField({ value, className, questionId }: FormatFieldProps) {
  if (!value) return null;

  // String value - delegate to FormatText
  if (typeof value === "string") {
    return <FormatText text={value} className={className} questionId={questionId} />;
  }

  // Structured field (duplet/blitz)
  if (!isStructuredField(value)) return null;

  const content = (
    <div className={className}>
      {value.header && (
        <div className="font-medium mb-2">
          <FormatText text={value.header} questionId={questionId} />
        </div>
      )}
      <div className="space-y-2">
        {value.items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <span className="text-muted-foreground shrink-0">{index + 1}.</span>
            <span className="whitespace-pre-wrap">
              <FormatText text={item} questionId={questionId} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // Wrap with context if questionId is provided
  if (questionId) {
    return <QuestionContext.Provider value={questionId}>{content}</QuestionContext.Provider>;
  }

  return content;
}

interface FormatAnswerFieldProps {
  value: QuestionFieldValue | null | undefined;
  className?: string;
  questionId?: Id<"questions">;
}

/**
 * Format answer field (more compact for answers)
 */
export function FormatAnswerField({ value, className, questionId }: FormatAnswerFieldProps) {
  if (!value) return null;

  // String value - delegate to FormatText
  if (typeof value === "string") {
    return <FormatText text={value} className={className} questionId={questionId} />;
  }

  // Structured field (duplet/blitz answers)
  if (!isStructuredField(value)) return null;

  return (
    <span className={className}>
      {value.items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="text-muted-foreground"> | </span>}
          <span>
            <span className="text-muted-foreground mr-1">{index + 1}.</span>
            <FormatText text={item} questionId={questionId} />
          </span>
        </Fragment>
      ))}
    </span>
  );
}
