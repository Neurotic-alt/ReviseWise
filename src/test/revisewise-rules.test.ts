import { describe, expect, it } from "vitest";
import { QUESTION_BANK } from "@/lib/data/question-bank";
import type { QuizAttempt } from "@/lib/data/types";
import { completionPercent, daysUntil, getWeekDays, toISODate } from "@/lib/planner";
import { topicsNeedingRevision } from "@/lib/progress";
import { generateSampleQuiz, scoreQuiz } from "@/lib/quiz";

describe("Quiz Studio", () => {
  it("returns exactly the requested number of questions for the chosen topic", () => {
    const quiz = generateSampleQuiz({
      subjectId: "physics",
      topicId: "forces",
      difficulty: "easy",
      count: 3,
    });
    expect(quiz).toHaveLength(3);
    expect(quiz.every((q) => q.subjectId === "physics" && q.topicId === "forces")).toBe(true);
  });

  it("puts questions of the chosen difficulty first", () => {
    const quiz = generateSampleQuiz({
      subjectId: "maths",
      topicId: "algebra",
      difficulty: "hard",
      count: 3,
    });
    expect(quiz[0]!.difficulty).toBe("hard");
    expect(quiz.slice(1).every((q) => q.difficulty === "medium")).toBe(true);
  });

  it("scores unanswered questions as wrong", () => {
    const qs = QUESTION_BANK.filter((q) => q.topicId === "cells").slice(0, 4);
    const [a, b] = [qs[0]!, qs[1]!];
    const answers = { [a.id]: a.answerIndex, [b.id]: b.answerIndex };
    expect(scoreQuiz(qs, answers)).toEqual({ correct: 2, total: 4, percent: 50 });
  });
});

describe("Revision Planner", () => {
  it("shows weeks from Monday to Sunday", () => {
    const days = getWeekDays(new Date(2026, 10, 19)); // Thu 19 Nov 2026
    expect(toISODate(days[0]!)).toBe("2026-11-16");
    expect(toISODate(days[6]!)).toBe("2026-11-22");
  });

  it("counts calendar days until an exam", () => {
    expect(daysUntil("2026-12-01", new Date(2026, 10, 19))).toBe(12);
  });

  it("computes completion from done tasks", () => {
    const base = { title: "x", subjectId: "maths" as const, date: "2026-11-19", durationMin: 30 };
    expect(
      completionPercent([
        { ...base, id: "a", done: true },
        { ...base, id: "b", done: false },
        { ...base, id: "c", done: false },
        { ...base, id: "d", done: true },
      ]),
    ).toBe(50);
  });
});

describe("My Progress", () => {
  const attempt = (id: string, topicId: string, correct: number, takenAt: string): QuizAttempt => ({
    id,
    subjectId: "maths",
    topicId,
    difficulty: "medium",
    correct,
    total: 5,
    takenAt,
    isDemo: false,
  });

  it("flags topics whose latest score is under 60%", () => {
    const weak = topicsNeedingRevision([
      attempt("1", "algebra", 2, "2026-11-01T10:00:00Z"), // 40%, but retaken later
      attempt("2", "algebra", 4, "2026-11-10T10:00:00Z"), // 80% latest
      attempt("3", "geometry", 3, "2026-11-05T10:00:00Z"), // 60% — not below threshold
      attempt("4", "geometry", 2, "2026-11-12T10:00:00Z"), // 40% latest
    ]);
    expect(weak.map((w) => w.topicId)).toEqual(["geometry"]);
  });
});
