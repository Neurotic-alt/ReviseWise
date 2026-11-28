import { QUESTION_BANK } from "./data/question-bank";
import type { Difficulty, QuizQuestion, SubjectId } from "./data/types";
import type { Marking } from "./study-context";

export const QUESTION_COUNTS = [5, 10, 15, 20, 30] as const;
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

export interface QuizRequest {
  subjectId: SubjectId;
  topicId: string;
  difficulty: Difficulty;
  count: number;
}

/**
 * Builds a sample quiz from the demonstration bank: questions at the chosen
 * difficulty come first, then the closest difficulties fill any remaining slots.
 */
export function generateSampleQuiz(req: QuizRequest, bank: QuizQuestion[] = QUESTION_BANK) {
  const pool = bank.filter((q) => q.subjectId === req.subjectId && q.topicId === req.topicId);
  const target = RANK[req.difficulty];
  return [...pool]
    .sort(
      (a, b) =>
        Math.abs(RANK[a.difficulty] - target) - Math.abs(RANK[b.difficulty] - target) ||
        RANK[a.difficulty] - RANK[b.difficulty],
    )
    .slice(0, Math.max(0, req.count));
}

export interface QuizScore {
  correct: number;
  total: number;
  percent: number;
}

/** Unanswered questions count as incorrect. */
export function scoreQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number | undefined>,
): QuizScore {
  const total = questions.length;
  const correct = questions.filter((q) => answers[q.id] === q.answerIndex).length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100) };
}

/** Marks one question earns: unanswered scores 0. */
export function questionMarks(q: QuizQuestion, answer: number | undefined, marking: Marking): number {
  if (answer === undefined) return 0;
  return answer === q.answerIndex ? marking.correct : marking.wrong;
}

export interface MarkedScore {
  marks: number;
  maxMarks: number;
  correct: number;
  wrong: number;
  unanswered: number;
  /** Marks as a share of the maximum, never below 0. */
  percent: number;
}

/** Exam-style score with negative marking. */
export function markQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number | undefined>,
  marking: Marking,
): MarkedScore {
  let marks = 0;
  let correct = 0;
  let wrong = 0;
  for (const q of questions) {
    const a = answers[q.id];
    marks += questionMarks(q, a, marking);
    if (a === undefined) continue;
    if (a === q.answerIndex) correct++;
    else wrong++;
  }
  const maxMarks = questions.length * marking.correct;
  return {
    marks,
    maxMarks,
    correct,
    wrong,
    unanswered: questions.length - correct - wrong,
    percent: maxMarks === 0 ? 0 : Math.round((Math.max(0, marks) / maxMarks) * 100),
  };
}

export function scoreBand(percent: number): "strong" | "developing" | "needs-revision" {
  if (percent >= 80) return "strong";
  if (percent >= 50) return "developing";
  return "needs-revision";
}
