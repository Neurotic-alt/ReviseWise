// Domain types shared by the UI and the future backend.
// Shapes intentionally mirror the tables a Lovable Cloud backend would use.

export type SubjectId = "maths" | "physics" | "chemistry" | "biology" | "english" | "history";

export type SubjectColor =
  "subject-1" | "subject-2" | "subject-3" | "subject-4" | "subject-5" | "subject-6";

export interface Topic {
  id: string;
  name: string;
}

export interface Subject {
  id: SubjectId;
  name: string;
  color: SubjectColor;
  topics: Topic[];
}

export type Difficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  /** Worked solution, one step per entry (AI quizzes). */
  steps?: string[];
  /** Set when the student typed their own subject; such questions are not saved to progress. */
  subjectLabel?: string;
}

export interface StudyTask {
  id: string;
  title: string;
  subjectId: SubjectId;
  /** yyyy-MM-dd */
  date: string;
  durationMin: number;
  done: boolean;
}

export interface ExamDate {
  id: string;
  subjectId: SubjectId;
  title: string;
  /** yyyy-MM-dd */
  date: string;
}

export interface QuizAttempt {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  difficulty: Difficulty;
  correct: number;
  total: number;
  /** ISO timestamp */
  takenAt: string;
  /** true for seeded demonstration records, false for attempts taken in this browser */
  isDemo: boolean;
  /** Questions answered wrongly or skipped (only recorded for the student's own attempts). */
  missedQuestionIds?: string[];
  /** Where the attempt came from. */
  source?: "studio" | "surprise";
  /** Wrong answers (student's own attempts; older records may not have it). */
  wrong?: number;
  /** Questions left unanswered. */
  skipped?: number;
  /** Exam-style marks earned and available, using the exam's marking scheme. */
  marks?: number;
  maxMarks?: number;
  /** Exam label the quiz was set for, e.g. "JEE". */
  exam?: string;
}

/** A quiz on a subject the student typed themselves (kept apart from built-in subject stats). */
export interface CustomQuizAttempt {
  id: string;
  subjectName: string;
  topicName: string;
  difficulty: Difficulty;
  correct: number;
  total: number;
  /** ISO timestamp */
  takenAt: string;
  exam?: string;
  level?: string;
  wrong?: number;
  skipped?: number;
  marks?: number;
  maxMarks?: number;
}

/** A real action the student took, used for daily missions and achievements. */
export interface ActivityEvent {
  id: string;
  kind: "task-done" | "companion-question";
  /** ISO timestamp */
  at: string;
  taskId?: string;
}

export interface StudentSettings {
  name: string;
  yearGroup: string;
  country: string;
  curriculum: string;
  language: string;
  explanationStyle: "step-by-step" | "concise" | "visual";
  sessionLengthMin: number;
  dailyGoalMin: number;
  reminders: boolean;
  shareAnonymousAnalytics: boolean;
  saveChatHistory: boolean;
}
