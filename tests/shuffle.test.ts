import { describe, expect, test } from "bun:test";
import { shuffleQuestions, maybeShuffleQuestions } from "@/lib/export/utils";
import type { Question } from "@/lib/db/encrypted-client";
import type { Id } from "@/convex/_generated/dataModel";

// Create mock questions for testing
function createMockQuestions(count: number): Question[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}` as Id<"questions">,
    package_id: "pkg1" as Id<"packages">,
    tour_id: null,
    order_num: i,
    number: i + 1,
    question: `Question ${i + 1}`,
    answer: `Answer ${i + 1}`,
    zachet: null,
    nezachet: null,
    comment: null,
    source: null,
    author: null,
    handout: null,
    type: "regular",
    handoutType: "none",
    handoutImageId: null,
    created_at: Date.now(),
  }));
}

describe("shuffleQuestions", () => {
  test("returns a new array without mutating original", () => {
    const questions = createMockQuestions(5);
    const original = [...questions];
    const shuffled = shuffleQuestions(questions, { seed: 42 });

    // Original should be unchanged
    expect(questions).toEqual(original);
    // Shuffled should be a different array reference
    expect(shuffled).not.toBe(questions);
  });

  test("returns same length array", () => {
    const questions = createMockQuestions(10);
    const shuffled = shuffleQuestions(questions, { seed: 123 });
    expect(shuffled.length).toBe(questions.length);
  });

  test("contains all original elements", () => {
    const questions = createMockQuestions(5);
    const shuffled = shuffleQuestions(questions, { seed: 42 });

    const originalIds = questions.map((q) => q.id).sort();
    const shuffledIds = shuffled.map((q) => q.id).sort();
    expect(shuffledIds).toEqual(originalIds);
  });

  test("deterministic with same seed", () => {
    const questions = createMockQuestions(10);
    const shuffle1 = shuffleQuestions(questions, { seed: 42 });
    const shuffle2 = shuffleQuestions(questions, { seed: 42 });

    expect(shuffle1.map((q) => q.id)).toEqual(shuffle2.map((q) => q.id));
  });

  test("different results with different seeds", () => {
    const questions = createMockQuestions(10);
    const shuffle1 = shuffleQuestions(questions, { seed: 42 });
    const shuffle2 = shuffleQuestions(questions, { seed: 43 });

    // With 10 elements, probability of same order is 1/10! which is negligible
    expect(shuffle1.map((q) => q.id)).not.toEqual(shuffle2.map((q) => q.id));
  });

  test("works with string seed", () => {
    const questions = createMockQuestions(10);
    const shuffle1 = shuffleQuestions(questions, { seed: "my-seed" });
    const shuffle2 = shuffleQuestions(questions, { seed: "my-seed" });

    expect(shuffle1.map((q) => q.id)).toEqual(shuffle2.map((q) => q.id));
  });

  test("different string seeds produce different results", () => {
    const questions = createMockQuestions(10);
    const shuffle1 = shuffleQuestions(questions, { seed: "seed-a" });
    const shuffle2 = shuffleQuestions(questions, { seed: "seed-b" });

    expect(shuffle1.map((q) => q.id)).not.toEqual(shuffle2.map((q) => q.id));
  });

  test("handles empty array", () => {
    const questions: Question[] = [];
    const shuffled = shuffleQuestions(questions, { seed: 42 });
    expect(shuffled).toEqual([]);
  });

  test("handles single element array", () => {
    const questions = createMockQuestions(1);
    const shuffled = shuffleQuestions(questions, { seed: 42 });
    expect(shuffled).toEqual(questions);
  });
});

describe("maybeShuffleQuestions", () => {
  test("does not shuffle when randomize is false", () => {
    const questions = createMockQuestions(10);
    const result = maybeShuffleQuestions(questions, { randomize: false });

    expect(result.map((q) => q.id)).toEqual(questions.map((q) => q.id));
  });

  test("does not shuffle when randomize is undefined", () => {
    const questions = createMockQuestions(10);
    const result = maybeShuffleQuestions(questions, {});

    expect(result.map((q) => q.id)).toEqual(questions.map((q) => q.id));
  });

  test("shuffles when randomize is true", () => {
    const questions = createMockQuestions(20);
    const result = maybeShuffleQuestions(questions, {
      randomize: true,
      randomizeSeed: 42,
    });

    // With high probability, order will be different
    expect(result.map((q) => q.id)).not.toEqual(questions.map((q) => q.id));
    // But all elements are preserved
    expect(result.map((q) => q.id).sort()).toEqual(questions.map((q) => q.id).sort());
  });

  test("uses seed when provided", () => {
    const questions = createMockQuestions(10);
    const result1 = maybeShuffleQuestions(questions, {
      randomize: true,
      randomizeSeed: 123,
    });
    const result2 = maybeShuffleQuestions(questions, {
      randomize: true,
      randomizeSeed: 123,
    });

    expect(result1.map((q) => q.id)).toEqual(result2.map((q) => q.id));
  });

  test("returns copy even when not shuffling", () => {
    const questions = createMockQuestions(5);
    const result = maybeShuffleQuestions(questions, { randomize: false });

    expect(result).not.toBe(questions);
    expect(result).toEqual(questions);
  });
});
