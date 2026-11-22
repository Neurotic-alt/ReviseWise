import { addDays, subDays } from "date-fns";
import { toISODate } from "../planner";
import type { ExamDate, QuizAttempt, StudentSettings, StudyTask, SubjectId } from "./types";

// Demonstration records. Everything here is sample data, not a real student's history,
// and the UI labels it as such.

export function seedTasks(today: Date): StudyTask[] {
  const d = (offset: number) => toISODate(addDays(today, offset));
  return [
    {
      id: "demo_t1",
      title: "Quadratic equations practice set",
      subjectId: "maths",
      date: d(0),
      durationMin: 30,
      done: true,
    },
    {
      id: "demo_t2",
      title: "Review Ohm's law notes",
      subjectId: "physics",
      date: d(0),
      durationMin: 25,
      done: false,
    },
    {
      id: "demo_t3",
      title: "Flashcards: cell organelles",
      subjectId: "biology",
      date: d(0),
      durationMin: 20,
      done: false,
    },
    {
      id: "demo_t4",
      title: "Essay plan: dramatic irony",
      subjectId: "english",
      date: d(1),
      durationMin: 40,
      done: false,
    },
    {
      id: "demo_t5",
      title: "Balancing equations drill",
      subjectId: "chemistry",
      date: d(1),
      durationMin: 30,
      done: false,
    },
    {
      id: "demo_t6",
      title: "Timeline: causes of WWI",
      subjectId: "history",
      date: d(2),
      durationMin: 35,
      done: false,
    },
    {
      id: "demo_t7",
      title: "Circle theorems past paper",
      subjectId: "maths",
      date: d(3),
      durationMin: 45,
      done: false,
    },
    {
      id: "demo_t8",
      title: "Food webs summary sheet",
      subjectId: "biology",
      date: d(-1),
      durationMin: 25,
      done: true,
    },
    {
      id: "demo_t9",
      title: "Forces & motion quiz",
      subjectId: "physics",
      date: d(-2),
      durationMin: 20,
      done: true,
    },
  ];
}

export function seedExams(today: Date): ExamDate[] {
  const d = (offset: number) => toISODate(addDays(today, offset));
  return [
    { id: "demo_e1", subjectId: "maths", title: "Maths Paper 1", date: d(12) },
    { id: "demo_e2", subjectId: "physics", title: "Physics mock", date: d(19) },
    { id: "demo_e3", subjectId: "english", title: "English Literature", date: d(26) },
  ];
}

export function seedQuizAttempts(today: Date): QuizAttempt[] {
  const at = (offset: number) => subDays(today, offset).toISOString();
  const rows: [SubjectId, string, QuizAttempt["difficulty"], number, number, number][] = [
    ["maths", "algebra", "medium", 4, 5, 1],
    ["physics", "electricity", "medium", 2, 5, 2],
    ["biology", "cells", "easy", 5, 5, 3],
    ["chemistry", "reactions", "medium", 3, 5, 5],
    ["english", "literature", "hard", 3, 5, 6],
    ["history", "ww1", "easy", 4, 5, 8],
    ["maths", "geometry", "hard", 2, 5, 9],
  ];
  return rows.map(([subjectId, topicId, difficulty, correct, total, offset], i) => ({
    id: `demo_q${i + 1}`,
    subjectId,
    topicId,
    difficulty,
    correct,
    total,
    takenAt: at(offset),
    isDemo: true,
  }));
}

export const DEFAULT_SETTINGS: StudentSettings = {
  name: "",
  yearGroup: "Year 10",
  country: "United Kingdom",
  curriculum: "GCSE",
  language: "English",
  explanationStyle: "step-by-step",
  sessionLengthMin: 30,
  dailyGoalMin: 60,
  reminders: true,
  shareAnonymousAnalytics: false,
  saveChatHistory: true,
};

/** Demo subject mastery, 0–100. */
export const DEMO_SUBJECT_PROGRESS: Record<SubjectId, number> = {
  maths: 72,
  physics: 58,
  biology: 84,
  chemistry: 63,
  english: 69,
  history: 77,
};

/** Demo study minutes for the last 14 days, oldest first. */
export const DEMO_DAILY_MINUTES = [35, 50, 0, 45, 60, 30, 20, 55, 40, 65, 0, 50, 70, 45];

export const DEMO_STUDY_SESSIONS: {
  id: string;
  subjectId: SubjectId;
  topic: string;
  daysAgo: number;
  durationMin: number;
  kind: "Revision" | "Quiz" | "AI Companion" | "Past paper";
}[] = [
  {
    id: "s1",
    subjectId: "maths",
    topic: "Quadratic equations",
    daysAgo: 0,
    durationMin: 30,
    kind: "Revision",
  },
  {
    id: "s2",
    subjectId: "physics",
    topic: "Electric circuits",
    daysAgo: 1,
    durationMin: 25,
    kind: "AI Companion",
  },
  {
    id: "s3",
    subjectId: "biology",
    topic: "Cell structure",
    daysAgo: 2,
    durationMin: 20,
    kind: "Quiz",
  },
  {
    id: "s4",
    subjectId: "english",
    topic: "Macbeth themes",
    daysAgo: 3,
    durationMin: 45,
    kind: "Revision",
  },
  {
    id: "s5",
    subjectId: "chemistry",
    topic: "Rates of reaction",
    daysAgo: 4,
    durationMin: 35,
    kind: "Past paper",
  },
  {
    id: "s6",
    subjectId: "history",
    topic: "Causes of WWI",
    daysAgo: 6,
    durationMin: 30,
    kind: "Revision",
  },
];
