// Export utilities

import type { Question } from "@/lib/db/schema";

/**
 * Seeded random number generator using Mulberry32 algorithm
 * Produces deterministic pseudo-random numbers when given a seed
 */
function mulberry32(initialSeed: number): () => number {
  let seed = initialSeed;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a seed from a string using DJB2 hash
 */
function stringToSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

export interface ShuffleOptions {
  /**
   * Seed for deterministic shuffle.
   * Can be a number or string (will be hashed to number).
   * If not provided, uses Math.random() for non-deterministic shuffle.
   */
  seed?: number | string;
}

/**
 * Shuffle questions using Fisher-Yates algorithm
 * Returns a new array with shuffled questions (does not mutate original)
 *
 * @param questions - Array of questions to shuffle
 * @param options - Optional shuffle options including seed for deterministic results
 * @returns New array with shuffled questions
 *
 * @example
 * // Non-deterministic shuffle
 * const shuffled = shuffleQuestions(questions);
 *
 * @example
 * // Deterministic shuffle with numeric seed
 * const shuffled = shuffleQuestions(questions, { seed: 42 });
 *
 * @example
 * // Deterministic shuffle with string seed
 * const shuffled = shuffleQuestions(questions, { seed: "my-package-id" });
 */
export function shuffleQuestions<T extends Question>(
  questions: readonly T[],
  options: ShuffleOptions = {},
): T[] {
  // Create a copy to avoid mutating the original
  const result = [...questions];

  if (result.length <= 1) {
    return result;
  }

  // Setup random function
  let random: () => number;

  if (options.seed !== undefined) {
    const numericSeed =
      typeof options.seed === "string" ? stringToSeed(options.seed) : options.seed;
    random = mulberry32(numericSeed);
  } else {
    random = Math.random;
  }

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Common randomization options for export functions
 */
export interface RandomizeOptions {
  /**
   * If true, randomize the order of questions before export
   */
  randomize?: boolean;
  /**
   * Seed for deterministic randomization.
   * Only used when randomize is true.
   */
  randomizeSeed?: number | string;
}

/**
 * Apply randomization to questions if enabled
 * Helper function for export modules
 */
export function maybeShuffleQuestions<T extends Question>(
  questions: readonly T[],
  options: RandomizeOptions,
): T[] {
  if (!options.randomize) {
    return [...questions];
  }

  return shuffleQuestions(questions, {
    seed: options.randomizeSeed,
  });
}
