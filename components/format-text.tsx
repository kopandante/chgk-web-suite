"use client";

import { Fragment } from "react";
import { QuestionImageById } from "./question-image";

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
      // Image placeholder match
      result.push(
        <QuestionImageById
          key={`img-${keyCounter++}`}
          imageId={match[2]}
          className="my-2 max-w-md"
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
}

/**
 * Format text: apply formatting (_italic_, __bold__, etc.), make URLs clickable, render images
 */
export function FormatText({ text, className }: FormatTextProps) {
  if (!text) return null;

  // Split by newlines and process each line
  const lines = text.split("\n");

  return (
    <span className={className}>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {parseTextWithLinksAndImages(line)}
        </Fragment>
      ))}
    </span>
  );
}

interface FormatSourceProps {
  source: string | null | undefined;
}

/**
 * Format source field - handles arrays stored as newline-separated strings
 */
export function FormatSource({ source }: FormatSourceProps) {
  if (!source) return null;

  const lines = source.split("\n").filter((line) => line.trim());

  if (lines.length === 1) {
    return <FormatText text={lines[0]} />;
  }

  return (
    <ul className="list-disc list-inside space-y-1">
      {lines.map((line, index) => (
        <li key={index}>
          <FormatText text={line} />
        </li>
      ))}
    </ul>
  );
}
