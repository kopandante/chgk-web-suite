"use client";

import { Fragment } from "react";

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s\n]+)/g;

/**
 * Restore underscores from parser placeholder
 */
function restoreUnderscores(text: string): string {
  return text.replace(/\$\$UNDERSCORE\$\$/g, "_");
}

/**
 * Parse text and convert URLs to clickable links
 */
function parseTextWithLinks(text: string): React.ReactNode[] {
  const restored = restoreUnderscores(text);
  const parts = restored.split(URL_REGEX);

  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:no-underline break-all"
        >
          {part}
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

interface FormatTextProps {
  text: string | null | undefined;
  className?: string;
}

/**
 * Format text: restore underscores, make URLs clickable
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
          {parseTextWithLinks(line)}
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
