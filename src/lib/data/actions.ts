import { parseISO } from "date-fns";
import { newId, toISODate } from "../planner";
import { activityStore, customQuizAttemptsStore, quizAttemptsStore, tasksStore } from "./stores";
import { markQuiz } from "../quiz";
import type { Marking } from "../study-context";
import type { CustomQuizAttempt, Difficulty, QuizQuestion } from "./types";

type Answers = Record<string, number | undefined>;

/** Right / wrong / skipped counts and exam marks for one group of questions. */
function tally(qs: QuizQuestion[], answers: Answers, marking: Marking | undefined) {
  const m = markQuiz(qs, answers, marking ?? { correct: 1, wrong: 0 });
  return {
    correct: m.correct,
    wrong: m.wrong,
    skipped: m.unanswered,
    ...(marking ? { marks: m.marks, maxMarks: m.maxMarks } : {}),
  };
}

/** Ticks or unticks a task and records the student's action for missions and achievements. */
export function setTaskDone(taskId: string, done: boolean) {
  tasksStore.set((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)));
  const todayKey = toISODate(new Date());
  activityStore.set((prev) =>
    done
      ? [...prev, { id: newId("ev"), kind: "task-done", at: new Date().toISOString(), taskId }]
      : prev.filter(
          (e) =>
            !(
              e.kind === "task-done" &&
              e.taskId === taskId &&
              toISODate(parseISO(e.at)) === todayKey
            ),
        ),
  );
}

export function logCompanionQuestion() {
  activityStore.set((prev) => [
    ...prev,
    { id: newId("ev"), kind: "companion-question", at: new Date().toISOString() },
  ]);
}

/**
 * Saves a finished quiz. Mixed quizzes (Surprise Me) are saved as one attempt per topic,
 * so each topic's progress and review schedule stays accurate.
 */
export function recordQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number | undefined>,
  meta: {
    difficulty: Difficulty | "mixed";
    source: "studio" | "surprise";
    marking?: Marking;
    exam?: string;
  },
) {
  const groups = new Map<string, QuizQuestion[]>();
  for (const q of questions) {
    const key = `${q.subjectId}:${q.topicId}`;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  const takenAt = new Date().toISOString();
  const rank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
  const created = [...groups.values()].map((qs) => {
    const first = qs[0] as QuizQuestion;
    const missed = qs.filter((q) => answers[q.id] !== q.answerIndex).map((q) => q.id);
    const hardest = qs.reduce(
      (h, q) => (rank[q.difficulty] > rank[h] ? q.difficulty : h),
      first.difficulty,
    );
    return {
      id: newId("q"),
      subjectId: first.subjectId,
      topicId: first.topicId,
      difficulty: meta.difficulty === "mixed" ? hardest : meta.difficulty,
      ...tally(qs, answers, meta.marking),
      total: qs.length,
      takenAt,
      isDemo: false,
      missedQuestionIds: missed,
      source: meta.source,
      ...(meta.exam ? { exam: meta.exam } : {}),
    };
  });
  quizAttemptsStore.set((prev) => [...prev, ...created]);
  return created;
}

/** Saves a finished quiz on typed subjects: one attempt per subject + topic. */
export function recordCustomQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number | undefined>,
  meta: { difficulty: Difficulty; exam?: string; level?: string; marking?: Marking },
) {
  const groups = new Map<string, QuizQuestion[]>();
  for (const q of questions) {
    if (!q.subjectLabel) continue;
    const key = `${q.subjectLabel}:${q.topicId}`;
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  const takenAt = new Date().toISOString();
  const created: CustomQuizAttempt[] = [...groups.values()].map((qs) => {
    const first = qs[0] as QuizQuestion;
    return {
      id: newId("cq"),
      subjectName: first.subjectLabel as string,
      topicName: first.topicId,
      difficulty: meta.difficulty,
      ...tally(qs, answers, meta.marking),
      total: qs.length,
      takenAt,
      ...(meta.exam ? { exam: meta.exam } : {}),
      ...(meta.level ? { level: meta.level } : {}),
    };
  });
  if (created.length) customQuizAttemptsStore.set((prev) => [...prev, ...created]);
  return created;
}
