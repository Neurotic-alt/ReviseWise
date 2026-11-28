import type { Difficulty, QuizAttempt, QuizQuestion, SubjectId } from "./data/types";
import { questionKey } from "./materials";
export type QuizDifficulty = Difficulty | "mixed";
export const BATCH_SIZE = 5;
export const MAX_QUIZ_COUNT = 30;
export function batchPlan(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_QUIZ_COUNT) throw new Error("Quiz size must be between 1 and 30.");
  return Array.from({ length: Math.ceil(count / BATCH_SIZE) }, (_, i) => Math.min(BATCH_SIZE, count - i * BATCH_SIZE));
}
export function batchDifficulty(difficulty: QuizDifficulty, batch: number): Difficulty {
  return difficulty === "mixed" ? (["easy", "medium", "hard"] as const)[batch % 3] ?? "medium" : difficulty;
}
export function uniqueQuestions(questions: QuizQuestion[], excluded: string[]) {
  const seen = new Set(excluded.map(questionKey));
  return questions.filter(q => { const key = questionKey(q.prompt); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function adaptiveDifficulty(attempts: QuizAttempt[], subjectId: SubjectId, topicId: string): { difficulty: Difficulty; reason: string } {
  const rows = attempts.filter(a => !a.isDemo && a.subjectId === subjectId && a.topicId === topicId).sort((a,b) => b.takenAt.localeCompare(a.takenAt)).slice(0,3);
  const total = rows.reduce((n,a) => n + a.correct + (a.wrong ?? Math.max(0,a.total - a.correct - (a.skipped ?? 0))), 0);
  if (rows.length < 2 || total < 10) return { difficulty: "medium", reason: "More answered questions are needed before adjusting difficulty." };
  const accuracy = rows.reduce((n,a) => n + a.correct, 0) / total;
  return accuracy < .6 ? { difficulty: "easy", reason: "Recent answers suggest starting with fundamentals." }
    : accuracy >= .85 ? { difficulty: "hard", reason: "Strong recent accuracy suggests a stretch challenge." }
    : { difficulty: "medium", reason: "Continue consolidating this topic." };
}
