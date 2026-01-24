"use client";

import { Fragment } from "react";
import { QuestionImageById } from "./question-image";

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s\n]+)/g;

// Image placeholder pattern: (img filename.ext) - supports various filename formats
const IMAGE_PLACEHOLDER_REGEX = /\(img\s+([A-Za-z0-9_()-]+)\.[a-z]+\)/gi;

/**
 * Restore underscores from escaped format
 */
function restoreUnderscores(text: string): string {
  return text.replace(/\\_/g, "_");
}

/**
 * Parse text and convert URLs to clickable links, images to QuestionImage components
 */
function parseTextWithLinksAndImages(text: string): React.ReactNode[] {
  const restored = restoreUnderscores(text);
  const result: React.ReactNode[] = [];

  // Combined pattern for both URLs and images
  const combinedRegex = /(https?:\/\/[^\s\n]+)|\(img\s+([A-Za-z0-9_()-]+)\.[a-z]+\)/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(restored)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(
        <Fragment key={`text-${lastIndex}`}>{restored.slice(lastIndex, match.index)}</Fragment>,
      );
    }

    if (match[1]) {
      // URL match
      result.push(
        <a
          key={`url-${match.index}`}
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
          key={`img-${match.index}`}
          imageId={match[2]}
          className="my-2 max-w-md"
        />,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < restored.length) {
    result.push(<Fragment key={`text-${lastIndex}`}>{restored.slice(lastIndex)}</Fragment>);
  }

  return result.length > 0 ? result : [<Fragment key="empty">{restored}</Fragment>];
}

interface FormatTextProps {
  text: string | null | undefined;
  className?: string;
}

/**
 * Format text: restore underscores, make URLs clickable, render images
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
