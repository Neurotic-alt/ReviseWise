import { addDays, format, parseISO } from "date-fns";
import { toISODate } from "./planner";
import { getSubject, getTopicName } from "./data/subjects";
import type { CustomQuizAttempt, Difficulty, QuizAttempt, SubjectId } from "./data/types";

// Quiz analytics for My Progress, built from the student's own saved quiz records
// (demo records are left out). Pure so the rules are testable.

export interface AnalyticsRow {
  /** Built-in subject id, or null for a typed subject. */
  subjectId: SubjectId | null;
  subjectName: string;
  topicName: string;
  difficulty: Difficulty;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  marks?: number | undefined;
  maxMarks?: number | undefined;
  exam?: string | undefined;
  takenAt: string;
}

/** The student's own attempts on built-in and typed subjects, as one list. */
export function ownQuizRows(attempts: QuizAttempt[], custom: CustomQuizAttempt[]): AnalyticsRow[] {
  const builtIn = attempts
    .filter((a) => !a.isDemo && a.total > 0)
    .map((a) => ({
      subjectId: a.subjectId,
      subjectName: getSubject(a.subjectId).name,
      topicName: getTopicName(a.subjectId, a.topicId),
      difficulty: a.difficulty,
      ...counts(a),
      marks: a.marks,
      maxMarks: a.maxMarks,
      exam: a.exam,
      takenAt: a.takenAt,
    }));
  const typed = custom
    .filter((a) => a.total > 0)
    .map((a) => ({
      subjectId: null,
      subjectName: a.subjectName.trim(),
      topicName: a.topicName.trim(),
      difficulty: a.difficulty,
      ...counts(a),
      marks: a.marks,
      maxMarks: a.maxMarks,
      exam: a.exam,
      takenAt: a.takenAt,
    }));
  return [...builtIn, ...typed].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

/** Older records only stored correct/total: everything not correct counts as wrong. */
function counts(a: { correct: number; total: number; wrong?: number; skipped?: number }) {
  const skipped = Math.max(0, Math.min(a.skipped ?? 0, a.total - a.correct));
  const wrong = a.wrong ?? a.total - a.correct - skipped;
  return { correct: a.correct, wrong, skipped, total: a.total };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

export interface QuizOverview {
  /** Quizzes finished (a mixed quiz saved per topic still counts once). */
  quizzes: number;
  questions: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Correct out of answered questions; null before any answer. */
  accuracy: number | null;
  /** Correct out of all questions, skipped included. */
  scorePercent: number | null;
  /** Share of questions answered. */
  attemptRate: number | null;
  marks: number;
  maxMarks: number;
}

export function quizOverview(rows: AnalyticsRow[]): QuizOverview {
  const t = rows.reduce(
    (s, r) => ({
      questions: s.questions + r.total,
      correct: s.correct + r.correct,
      wrong: s.wrong + r.wrong,
      skipped: s.skipped + r.skipped,
      marks: s.marks + (r.maxMarks ? (r.marks ?? 0) : 0),
      maxMarks: s.maxMarks + (r.maxMarks ?? 0),
    }),
    { questions: 0, correct: 0, wrong: 0, skipped: 0, marks: 0, maxMarks: 0 },
  );
  const attempted = t.correct + t.wrong;
  return {
    quizzes: new Set(rows.map((r) => r.takenAt)).size,
    ...t,
    attempted,
    accuracy: pct(t.correct, attempted),
    scorePercent: pct(t.correct, t.questions),
    attemptRate: pct(attempted, t.questions),
  };
}

export interface TopicPerformance {
  key: string;
  subjectId: SubjectId | null;
  subjectName: string;
  topicName: string;
  quizzes: number;
  questions: number;
  correct: number;
  attempted: number;
  accuracy: number | null;
  /** Correct out of all questions in the latest quiz on this topic. */
  latestPercent: number;
  /** Latest score minus the previous one; null with only one quiz. */
  change: number | null;
  lastTakenAt: string;
  status: "strong" | "developing" | "needs-revision";
}

export const STRONG_ACCURACY = 80;
export const DEVELOPING_ACCURACY = 50;

/** Accuracy band for a topic or subject. */
export function accuracyBand(accuracy: number | null): TopicPerformance["status"] {
  if (accuracy !== null && accuracy >= STRONG_ACCURACY) return "strong";
  if (accuracy !== null && accuracy >= DEVELOPING_ACCURACY) return "developing";
  return "needs-revision";
}

/** Per-topic results, weakest accuracy first (ties: most recent first). */
export function topicPerformance(rows: AnalyticsRow[]): TopicPerformance[] {
  const groups = new Map<string, AnalyticsRow[]>();
  for (const r of rows) {
    const key = `${r.subjectId ?? r.subjectName.toLowerCase()}:${r.topicName.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
      const latest = sorted[0] as AnalyticsRow;
      const previous = sorted[1];
      const correct = list.reduce((s, r) => s + r.correct, 0);
      const attempted = list.reduce((s, r) => s + r.correct + r.wrong, 0);
      const latestPercent = pct(latest.correct, latest.total) ?? 0;
      const accuracy = pct(correct, attempted);
      return {
        key,
        subjectId: latest.subjectId,
        subjectName: latest.subjectName,
        topicName: latest.topicName,
        quizzes: new Set(list.map((r) => r.takenAt)).size,
        questions: list.reduce((s, r) => s + r.total, 0),
        correct,
        attempted,
        accuracy,
        latestPercent,
        change: previous ? latestPercent - (pct(previous.correct, previous.total) ?? 0) : null,
        lastTakenAt: latest.takenAt,
        status: accuracyBand(accuracy),
      };
    })
    .sort(
      (a, b) => (a.accuracy ?? -1) - (b.accuracy ?? -1) || b.lastTakenAt.localeCompare(a.lastTakenAt),
    );
}

export interface SubjectAccuracy {
  subjectId: SubjectId | null;
  subjectName: string;
  questions: number;
  attempted: number;
  correct: number;
  accuracy: number | null;
  topics: number;
}

/** Accuracy per subject, most questions first. */
export function subjectAccuracy(rows: AnalyticsRow[]): SubjectAccuracy[] {
  const groups = new Map<string, AnalyticsRow[]>();
  for (const r of rows) {
    const key = r.subjectId ?? `custom:${r.subjectName.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()]
    .map((list) => {
      const first = list[0] as AnalyticsRow;
      const correct = list.reduce((s, r) => s + r.correct, 0);
      const attempted = list.reduce((s, r) => s + r.correct + r.wrong, 0);
      return {
        subjectId: first.subjectId,
        subjectName: first.subjectName,
        questions: list.reduce((s, r) => s + r.total, 0),
        attempted,
        correct,
        accuracy: pct(correct, attempted),
        topics: new Set(list.map((r) => r.topicName.toLowerCase())).size,
      };
    })
    .sort((a, b) => b.questions - a.questions);
}

export interface DayAccuracy {
  /** yyyy-MM-dd */
  date: string;
  label: string;
  questions: number;
  /** Null on days with no answered questions. */
  accuracy: number | null;
}

/** Daily accuracy for the last `days` days, oldest first, ending today. */
export function accuracyByDay(rows: AnalyticsRow[], today: Date, days = 14): DayAccuracy[] {
  const byDay = new Map<string, { correct: number; attempted: number; questions: number }>();
  for (const r of rows) {
    const d = toISODate(parseISO(r.takenAt));
    const s = byDay.get(d) ?? { correct: 0, attempted: 0, questions: 0 };
    s.correct += r.correct;
    s.attempted += r.correct + r.wrong;
    s.questions += r.total;
    byDay.set(d, s);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    const date = toISODate(day);
    const s = byDay.get(date);
    return {
      date,
      label: format(day, "d MMM"),
      questions: s?.questions ?? 0,
      accuracy: s ? pct(s.correct, s.attempted) : null,
    };
  });
}
