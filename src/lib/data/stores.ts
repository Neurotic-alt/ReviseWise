import { createPersistentStore } from "../store";
import { DEFAULT_SETTINGS, seedExams, seedQuizAttempts, seedTasks } from "./demo-data";
import type { ChatMessage } from "../companion";
import type {
  ActivityEvent,
  CustomQuizAttempt,
  ExamDate,
  QuizAttempt,
  StudentSettings,
  StudyTask,
} from "./types";

const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

export const tasksStore = createPersistentStore<StudyTask[]>("tasks", () => seedTasks(today()));
export const examsStore = createPersistentStore<ExamDate[]>("exams", () => seedExams(today()));
export const quizAttemptsStore = createPersistentStore<QuizAttempt[]>("quiz-attempts", () =>
  seedQuizAttempts(today()),
);
/** Quiz scores on subjects the student typed themselves. */
export const customQuizAttemptsStore = createPersistentStore<CustomQuizAttempt[]>(
  "custom-quiz-attempts",
  () => [],
);
export const settingsStore = createPersistentStore<StudentSettings>("settings", () => ({
  ...DEFAULT_SETTINGS,
}));

export const activityStore = createPersistentStore<ActivityEvent[]>("activity", () => []);
/** Dates (yyyy-MM-dd) on which all three daily missions were completed. */
export const missionDaysStore = createPersistentStore<string[]>("mission-days", () => []);
export const chatStore = createPersistentStore<ChatMessage[]>("companion-chat", () => []);

/** Recently asked prompts, kept per student to avoid repeated practice. */
export const questionHistoryStore = createPersistentStore<string[]>("question-history", () => []);
