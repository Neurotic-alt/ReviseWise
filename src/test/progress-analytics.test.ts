import { describe, expect, it } from "vitest";
import { accuracyByDay, ownQuizRows, quizOverview, topicPerformance } from "@/lib/analytics";
import type { CustomQuizAttempt, QuizAttempt } from "@/lib/data/types";

const attempt = (over: Partial<QuizAttempt>): QuizAttempt => ({
  id: Math.random().toString(36),
  subjectId: "physics",
  topicId: "forces",
  difficulty: "medium",
  correct: 3,
  total: 5,
  takenAt: "2026-11-20T10:00:00.000Z",
  isDemo: false,
  ...over,
});

describe("My Progress analytics", () => {
  it("leaves demo records out", () => {
    const rows = ownQuizRows([attempt({ isDemo: true }), attempt({})], []);
    expect(rows).toHaveLength(1);
  });

  it("accuracy counts only answered questions: 3 right, 1 wrong, 1 skipped is 75%", () => {
    const o = quizOverview(ownQuizRows([attempt({ correct: 3, wrong: 1, skipped: 1, total: 5 })], []));
    expect(o).toMatchObject({ accuracy: 75, scorePercent: 60, attempted: 4, skipped: 1 });
  });

  it("adds up exam marks across quizzes", () => {
    const o = quizOverview(
      ownQuizRows(
        [attempt({ marks: 7, maxMarks: 16, takenAt: "2026-11-19T10:00:00.000Z" })],
        [{ id: "c", subjectName: "Economics", topicName: "GDP", difficulty: "easy", correct: 2, total: 3,
          takenAt: "2026-11-20T10:00:00.000Z", marks: 2, maxMarks: 3 } satisfies CustomQuizAttempt],
      ),
    );
    expect(o).toMatchObject({ marks: 9, maxMarks: 19, quizzes: 2 });
  });

  it("counts a mixed quiz saved per topic as one quiz", () => {
    const t = "2026-11-20T10:00:00.000Z";
    const o = quizOverview(ownQuizRows([attempt({ takenAt: t }), attempt({ topicId: "waves", takenAt: t })], []));
    expect(o.quizzes).toBe(1);
  });

  it("lists topics weakest first with the change since the previous quiz", () => {
    const rows = ownQuizRows(
      [
        attempt({ topicId: "forces", correct: 2, total: 5, takenAt: "2026-11-18T10:00:00.000Z" }),
        attempt({ topicId: "forces", correct: 4, total: 5, takenAt: "2026-11-20T10:00:00.000Z" }),
        attempt({ topicId: "waves", correct: 1, total: 5, takenAt: "2026-11-19T10:00:00.000Z" }),
      ],
      [],
    );
    const topics = topicPerformance(rows);
    expect(topics.map((t) => t.accuracy)).toEqual([20, 60]);
    expect(topics[1]).toMatchObject({ quizzes: 2, accuracy: 60, latestPercent: 80, change: 40 });
    expect(topics[0]?.status).toBe("needs-revision");
  });

  it("charts 14 days ending today, with empty days left blank", () => {
    const days = accuracyByDay(
      ownQuizRows([attempt({ correct: 4, wrong: 1, total: 5, takenAt: "2026-11-22T08:00:00" })], []),
      new Date(2026, 10, 22),
    );
    expect(days).toHaveLength(14);
    expect(days.at(-1)).toMatchObject({ date: "2026-11-22", accuracy: 80 });
    expect(days[0]?.accuracy).toBeNull();
  });
});
