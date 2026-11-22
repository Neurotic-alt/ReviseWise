import { describe, expect, it } from "vitest";
import type { ActivityEvent, QuizAttempt, StudyTask } from "@/lib/data/types";
import {
  achievements,
  dailyMissions,
  missionTopic,
  revisionDue,
  reviewIntervalDays,
  surpriseQuiz,
  weakAreas,
  weeklySummary,
} from "@/lib/learning";

const today = new Date(2026, 10, 19, 0, 0, 0); // Thu 19 Nov 2026, local midnight
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

const attempt = (p: Partial<QuizAttempt> & { correct: number; takenAt: string }): QuizAttempt => ({
  id: Math.random().toString(36),
  subjectId: "maths",
  topicId: "algebra",
  difficulty: "medium",
  total: 5,
  isDemo: false,
  ...p,
});

describe("Revision Due", () => {
  it("reviews after 1 day under 60%, 3 days under 80%, 7 days from 80%", () => {
    expect(reviewIntervalDays(40)).toBe(1);
    expect(reviewIntervalDays(60)).toBe(3);
    expect(reviewIntervalDays(79)).toBe(3);
    expect(reviewIntervalDays(80)).toBe(7);
  });

  it("lists a topic once its review date arrives", () => {
    const due = revisionDue(
      [
        attempt({ topicId: "algebra", correct: 4, takenAt: at(2026, 10, 12) }), // 80%, 7 days ago -> due
        attempt({ topicId: "geometry", correct: 4, takenAt: at(2026, 10, 13) }), // 80%, 6 days ago -> not due
        attempt({ subjectId: "physics", topicId: "forces", correct: 2, takenAt: at(2026, 10, 18) }), // 40%, yesterday -> due
      ],
      today,
    );
    expect(due.map((d) => d.topicId).sort()).toEqual(["algebra", "forces"]);
  });
});

describe("Your Weak Areas", () => {
  it("lists topics under 60% with the questions missed", () => {
    const weak = weakAreas([
      attempt({ correct: 2, takenAt: at(2026, 10, 18), missedQuestionIds: ["maths-algebra-1"] }),
      attempt({ topicId: "geometry", correct: 3, takenAt: at(2026, 10, 18) }),
    ]);
    expect(weak).toHaveLength(1);
    expect(weak[0]!.topicId).toBe("algebra");
    expect(weak[0]!.missedConcepts).toEqual(["Solve for x: 2x + 6 = 14"]);
  });
});

describe("Daily Mission", () => {
  const tasks: StudyTask[] = [
    { id: "t1", title: "x", subjectId: "maths", date: "2026-11-19", durationMin: 30, done: true },
  ];

  it("gives three missions and seeded data alone completes none", () => {
    const missions = dailyMissions(today, {
      tasks,
      attempts: [attempt({ correct: 2, takenAt: at(2026, 10, 19), isDemo: true })],
      activity: [],
    });
    expect(missions).toHaveLength(3);
    expect(missions.filter((m) => m.done)).toHaveLength(0);
  });

  it("completes each mission from the student's own actions today", () => {
    const attempts = [attempt({ correct: 2, takenAt: at(2026, 10, 18) })];
    const topic = missionTopic(attempts, today);
    const activity: ActivityEvent[] = [
      { id: "a", kind: "task-done", at: at(2026, 10, 19), taskId: "t1" },
      { id: "b", kind: "companion-question", at: at(2026, 10, 19) },
    ];
    const missions = dailyMissions(today, {
      tasks,
      attempts: [...attempts, attempt({ ...topic, correct: 4, takenAt: at(2026, 10, 19) })],
      activity,
    });
    expect(missions.every((m) => m.done)).toBe(true);
  });

  it("does not count yesterday's actions", () => {
    const missions = dailyMissions(today, {
      tasks,
      attempts: [],
      activity: [{ id: "a", kind: "task-done", at: at(2026, 10, 18), taskId: "t1" }],
    });
    expect(missions[0]!.done).toBe(false);
  });
});

describe("Surprise Me", () => {
  const attempts = [
    attempt({
      subjectId: "physics",
      topicId: "electricity",
      correct: 1,
      takenAt: at(2026, 10, 18),
    }),
  ];

  it("builds 5 questions from 5 different topics including the weak one", () => {
    const quiz = surpriseQuiz(attempts, today, 42);
    expect(quiz).toHaveLength(5);
    expect(new Set(quiz.map((q) => `${q.subjectId}:${q.topicId}`)).size).toBe(5);
    expect(quiz.some((q) => q.topicId === "electricity")).toBe(true);
  });

  it("gives the same test for the same seed and a different one for another seed", () => {
    const ids = (seed: number) =>
      surpriseQuiz(attempts, today, seed)
        .map((q) => q.id)
        .join();
    expect(ids(7)).toBe(ids(7));
    expect(ids(7)).not.toBe(ids(8));
  });
});

describe("Learning Achievements", () => {
  const base = { activity: [], exams: [], missionDays: [] };

  it("does not unlock anything from demo records", () => {
    const list = achievements({
      ...base,
      attempts: [attempt({ correct: 5, takenAt: at(2026, 10, 18), isDemo: true })],
    });
    expect(list.filter((a) => a.unlocked)).toHaveLength(0);
  });

  it("unlocks Comeback when a retake improves by 20 points", () => {
    const list = achievements({
      ...base,
      attempts: [
        attempt({ correct: 2, takenAt: at(2026, 10, 17) }),
        attempt({ correct: 3, takenAt: at(2026, 10, 18) }),
      ],
    });
    expect(list.find((a) => a.id === "comeback")?.unlocked).toBe(true);
    expect(list.find((a) => a.id === "first-quiz")?.unlocked).toBe(true);
    expect(list.find((a) => a.id === "full-marks")?.unlocked).toBe(false);
  });
});

describe("Weekly Learning Summary", () => {
  it("adds up completed study minutes this week and finds improved topics", () => {
    const tasks: StudyTask[] = [
      { id: "a", title: "a", subjectId: "maths", date: "2026-11-16", durationMin: 30, done: true },
      { id: "b", title: "b", subjectId: "maths", date: "2026-11-18", durationMin: 45, done: true },
      { id: "c", title: "c", subjectId: "maths", date: "2026-11-18", durationMin: 20, done: false },
      { id: "d", title: "d", subjectId: "maths", date: "2026-11-12", durationMin: 25, done: true },
    ];
    const summary = weeklySummary(
      tasks,
      [
        attempt({ correct: 2, takenAt: at(2026, 10, 10) }),
        attempt({ correct: 4, takenAt: at(2026, 10, 17) }),
      ],
      today,
    );
    expect(summary.thisWeek.studyMinutes).toBe(75);
    expect(summary.lastWeek.studyMinutes).toBe(25);
    expect(summary.thisWeek.quizzes).toBe(1);
    expect(summary.improved).toEqual([
      { subjectId: "maths", topicId: "algebra", from: 40, to: 80 },
    ]);
  });
});
