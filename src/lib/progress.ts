import type { CustomQuizAttempt, QuizAttempt, SubjectId } from "./data/types";

export const REVISION_THRESHOLD = 60;

/** Topics whose most recent quiz score is below the revision threshold, weakest first. */
export function topicsNeedingRevision(attempts: QuizAttempt[], threshold = REVISION_THRESHOLD) {
  const latest = new Map<string, QuizAttempt>();
  for (const a of attempts) {
    const key = `${a.subjectId}:${a.topicId}`;
    const prev = latest.get(key);
    if (!prev || a.takenAt > prev.takenAt) latest.set(key, a);
  }
  return [...latest.values()]
    .map((a) => ({ ...a, percent: Math.round((a.correct / a.total) * 100) }))
    .filter((a) => a.percent < threshold)
    .sort((a, b) => a.percent - b.percent);
}

export function averageBySubject(attempts: QuizAttempt[]) {
  const sums = new Map<SubjectId, { total: number; n: number }>();
  for (const a of attempts) {
    const s = sums.get(a.subjectId) ?? { total: 0, n: 0 };
    s.total += a.correct / a.total;
    s.n += 1;
    sums.set(a.subjectId, s);
  }
  const out: Partial<Record<SubjectId, number>> = {};
  sums.forEach((v, k) => (out[k] = Math.round((v.total / v.n) * 100)));
  return out;
}

export interface CustomSubjectStats {
  subjectName: string;
  quizzes: number;
  averagePercent: number;
  latestPercent: number;
  lastTakenAt: string;
  topics: string[];
}

/**
 * Groups typed-subject quiz scores by subject (case-insensitive), newest activity first.
 * Average is over all quizzes; latest is the most recent quiz's score.
 */
export function customSubjectStats(attempts: CustomQuizAttempt[]): CustomSubjectStats[] {
  const groups = new Map<string, CustomQuizAttempt[]>();
  for (const a of attempts) {
    const key = a.subjectName.trim().toLowerCase();
    if (!key || a.total <= 0) continue;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
      const latest = sorted[0] as CustomQuizAttempt;
      const avg = list.reduce((sum, a) => sum + a.correct / a.total, 0) / list.length;
      return {
        subjectName: latest.subjectName.trim(),
        quizzes: list.length,
        averagePercent: Math.round(avg * 100),
        latestPercent: Math.round((latest.correct / latest.total) * 100),
        lastTakenAt: latest.takenAt,
        topics: [...new Set(sorted.map((a) => a.topicName))],
      };
    })
    .sort((a, b) => b.lastTakenAt.localeCompare(a.lastTakenAt));
}
