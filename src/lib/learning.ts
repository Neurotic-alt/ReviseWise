import { addDays, parseISO, startOfWeek, subWeeks } from "date-fns";
import { QUESTION_BANK } from "./data/question-bank";
import { SUBJECTS, getTopicName } from "./data/subjects";
import type {
  ActivityEvent,
  Difficulty,
  ExamDate,
  QuizAttempt,
  QuizQuestion,
  StudyTask,
  SubjectId,
} from "./data/types";
import { daysUntil, toISODate } from "./planner";

// ---------------------------------------------------------------------------
// Shared helpers

export const isDemoRecord = (id: string) => id.startsWith("demo_");
export const percentOf = (a: Pick<QuizAttempt, "correct" | "total">) =>
  a.total === 0 ? 0 : Math.round((a.correct / a.total) * 100);
const topicKey = (subjectId: SubjectId, topicId: string) => `${subjectId}:${topicId}`;
const localDate = (iso: string) => toISODate(parseISO(iso));

export interface TopicRef {
  subjectId: SubjectId;
  topicId: string;
}

export const ALL_TOPICS: TopicRef[] = SUBJECTS.flatMap((s) =>
  s.topics.map((t) => ({ subjectId: s.id, topicId: t.id })),
);

export function latestAttemptByTopic(attempts: QuizAttempt[]) {
  const latest = new Map<string, QuizAttempt>();
  for (const a of attempts) {
    const key = topicKey(a.subjectId, a.topicId);
    const prev = latest.get(key);
    if (!prev || a.takenAt > prev.takenAt) latest.set(key, a);
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Revision Due — simple spaced review

/** Days until a topic should be reviewed again, based on the latest score. */
export function reviewIntervalDays(percent: number) {
  if (percent < 60) return 1;
  if (percent < 80) return 3;
  return 7;
}

export interface DueTopic extends TopicRef {
  percent: number;
  lastStudied: string;
  dueDate: string;
  daysOverdue: number;
  isDemo: boolean;
}

/** Topics whose review date has arrived, most overdue first. */
export function revisionDue(attempts: QuizAttempt[], today: Date): DueTopic[] {
  const out: DueTopic[] = [];
  latestAttemptByTopic(attempts).forEach((a) => {
    const percent = percentOf(a);
    const lastStudied = localDate(a.takenAt);
    const dueDate = toISODate(addDays(parseISO(lastStudied), reviewIntervalDays(percent)));
    const daysOverdue = -daysUntil(dueDate, today);
    if (daysOverdue >= 0) {
      out.push({
        subjectId: a.subjectId,
        topicId: a.topicId,
        percent,
        lastStudied,
        dueDate,
        daysOverdue,
        isDemo: a.isDemo,
      });
    }
  });
  return out.sort((x, y) => y.daysOverdue - x.daysOverdue || x.percent - y.percent);
}

// ---------------------------------------------------------------------------
// Your Weak Areas

export const WEAK_THRESHOLD = 60;

export interface WeakArea extends TopicRef {
  percent: number;
  /** Prompts of questions missed in the latest own attempt, if recorded. */
  missedConcepts: string[];
  isDemo: boolean;
}

export function weakAreas(
  attempts: QuizAttempt[],
  bank: QuizQuestion[] = QUESTION_BANK,
  threshold = WEAK_THRESHOLD,
): WeakArea[] {
  const out: WeakArea[] = [];
  latestAttemptByTopic(attempts).forEach((a) => {
    const percent = percentOf(a);
    if (percent >= threshold) return;
    const missedConcepts = (a.missedQuestionIds ?? [])
      .map((id) => bank.find((q) => q.id === id)?.prompt)
      .filter((p): p is string => Boolean(p));
    out.push({
      subjectId: a.subjectId,
      topicId: a.topicId,
      percent,
      missedConcepts,
      isDemo: a.isDemo,
    });
  });
  return out.sort((x, y) => x.percent - y.percent);
}

// ---------------------------------------------------------------------------
// Daily Mission

export interface Mission {
  id: "study-task" | "practise-topic" | "ask-companion";
  title: string;
  detail: string;
  done: boolean;
  topic?: TopicRef;
}

const dayNumber = (d: Date) => Math.floor(d.getTime() / 86_400_000);

/**
 * The topic today's mission focuses on: most overdue, then weakest, then a daily rotation.
 * Only attempts from before today count, so the target stays fixed while the student works on it.
 */
export function missionTopic(allAttempts: QuizAttempt[], today: Date): TopicRef {
  const todayKey = toISODate(today);
  const attempts = allAttempts.filter((a) => localDate(a.takenAt) < todayKey);
  const due = revisionDue(attempts, today)[0];
  if (due) return { subjectId: due.subjectId, topicId: due.topicId };
  const weak = weakAreas(attempts)[0];
  if (weak) return { subjectId: weak.subjectId, topicId: weak.topicId };
  return ALL_TOPICS[dayNumber(today) % ALL_TOPICS.length] as TopicRef;
}

/** Three small goals for today. Only the student's own actions complete them. */
export function dailyMissions(
  today: Date,
  data: { tasks: StudyTask[]; attempts: QuizAttempt[]; activity: ActivityEvent[] },
): Mission[] {
  const todayKey = toISODate(today);
  const todayEvents = data.activity.filter((e) => localDate(e.at) === todayKey);
  const topic = missionTopic(data.attempts, today);
  const hasTasksToday = data.tasks.some((t) => t.date === todayKey);

  return [
    {
      id: "study-task",
      title: hasTasksToday ? "Complete a study task" : "Complete a study session",
      detail: hasTasksToday
        ? "Tick off one of today's planned tasks."
        : "Add a short session to today's plan, then tick it off.",
      done: todayEvents.some((e) => e.kind === "task-done"),
    },
    {
      id: "practise-topic",
      title: `Practise ${getTopicName(topic.subjectId, topic.topicId)}`,
      detail: "Take a quick quiz on this topic.",
      topic,
      done: data.attempts.some(
        (a) =>
          !a.isDemo &&
          localDate(a.takenAt) === todayKey &&
          a.subjectId === topic.subjectId &&
          a.topicId === topic.topicId,
      ),
    },
    {
      id: "ask-companion",
      title: "Ask the AI Companion",
      detail: "Ask one question you're unsure about.",
      done: todayEvents.some((e) => e.kind === "companion-question"),
    },
  ];
}

// ---------------------------------------------------------------------------
// Surprise Me — personalised practice test

/** Small deterministic random generator so a seed always gives the same quiz. */
function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function shuffle<T>(items: T[], rand: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export const SURPRISE_QUESTION_COUNT = 5;

/**
 * Builds a mixed practice test: up to three priority topics (due for revision or weak)
 * get easier questions first; the rest of the test comes from other topics at a harder level.
 */
export function surpriseQuiz(
  attempts: QuizAttempt[],
  today: Date,
  seed: number,
  bank: QuizQuestion[] = QUESTION_BANK,
  count = SURPRISE_QUESTION_COUNT,
): QuizQuestion[] {
  const rand = seededRandom(seed);
  const priority: string[] = [];
  for (const t of [...revisionDue(attempts, today), ...weakAreas(attempts, bank)]) {
    const key = topicKey(t.subjectId, t.topicId);
    if (!priority.includes(key)) priority.push(key);
  }
  const priorityTopics = priority.slice(0, 3);
  const rank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

  const picked: QuizQuestion[] = [];
  for (const key of priorityTopics) {
    const pool = bank
      .filter((q) => topicKey(q.subjectId, q.topicId) === key)
      .sort((a, b) => rank[a.difficulty] - rank[b.difficulty] || rand() - 0.5);
    const q = pool.find((x) => x.difficulty !== "hard") ?? pool[0];
    if (q) picked.push(q);
  }

  const rest = shuffle(
    bank.filter(
      (q) => !picked.includes(q) && !priorityTopics.includes(topicKey(q.subjectId, q.topicId)),
    ),
    rand,
  ).sort((a, b) => rank[b.difficulty] - rank[a.difficulty]);
  const usedTopics = new Set(picked.map((q) => topicKey(q.subjectId, q.topicId)));
  for (const q of rest) {
    if (picked.length >= count) break;
    const key = topicKey(q.subjectId, q.topicId);
    if (usedTopics.has(key)) continue;
    usedTopics.add(key);
    picked.push(q);
  }
  return shuffle(picked.slice(0, count), rand);
}

// ---------------------------------------------------------------------------
// Learning Achievements — personal milestones only, never ranked against others

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

export function achievements(data: {
  attempts: QuizAttempt[];
  activity: ActivityEvent[];
  exams: ExamDate[];
  missionDays: string[];
}): Achievement[] {
  const own = data.attempts
    .filter((a) => !a.isDemo)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const tasksDone = new Set(
    data.activity.filter((e) => e.kind === "task-done").map((e) => e.taskId),
  ).size;
  const subjects = new Set(own.map((a) => a.subjectId)).size;
  const ownExams = data.exams.filter((e) => !isDemoRecord(e.id)).length;

  let comeback = false;
  const lastByTopic = new Map<string, number>();
  for (const a of data.attempts.slice().sort((x, y) => x.takenAt.localeCompare(y.takenAt))) {
    const key = topicKey(a.subjectId, a.topicId);
    const prev = lastByTopic.get(key);
    if (!a.isDemo && prev !== undefined && percentOf(a) - prev >= 20) comeback = true;
    lastByTopic.set(key, percentOf(a));
  }

  return [
    {
      id: "first-quiz",
      title: "First steps",
      description: "Finish your first quiz.",
      unlocked: own.length >= 1,
    },
    {
      id: "full-marks",
      title: "Full marks",
      description: "Score 100% on a quiz topic.",
      unlocked: own.some((a) => a.total > 0 && a.correct === a.total),
    },
    {
      id: "comeback",
      title: "Comeback",
      description: "Improve a topic's score by 20 points or more.",
      unlocked: comeback,
    },
    {
      id: "steady",
      title: "Steady studier",
      description: "Complete 5 study tasks.",
      unlocked: tasksDone >= 5,
      progress: { current: Math.min(tasksDone, 5), target: 5 },
    },
    {
      id: "explorer",
      title: "All-rounder",
      description: "Practise all six subjects.",
      unlocked: subjects >= SUBJECTS.length,
      progress: { current: subjects, target: SUBJECTS.length },
    },
    {
      id: "mission",
      title: "Mission complete",
      description: "Finish all three daily missions in one day.",
      unlocked: data.missionDays.length >= 1,
    },
    {
      id: "mission-streak",
      title: "Three-day rhythm",
      description: "Finish your daily missions on 3 different days.",
      unlocked: data.missionDays.length >= 3,
      progress: { current: Math.min(data.missionDays.length, 3), target: 3 },
    },
    {
      id: "exam-ready",
      title: "Planning ahead",
      description: "Add one of your exam dates.",
      unlocked: ownExams >= 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Weekly Learning Summary

export interface WeekStats {
  studyMinutes: number;
  tasksDone: number;
  quizzes: number;
  averageScore: number | null;
}

export interface WeeklySummary {
  weekStart: string;
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  topicsPractised: TopicRef[];
  improved: (TopicRef & { from: number; to: number })[];
  includesDemo: boolean;
}

function statsFor(tasks: StudyTask[], attempts: QuizAttempt[]): WeekStats {
  const done = tasks.filter((t) => t.done);
  return {
    studyMinutes: done.reduce((s, t) => s + t.durationMin, 0),
    tasksDone: done.length,
    quizzes: attempts.length,
    averageScore: attempts.length
      ? Math.round(attempts.reduce((s, a) => s + percentOf(a), 0) / attempts.length)
      : null,
  };
}

/** This week (Monday to today) compared with last week. */
export function weeklySummary(
  tasks: StudyTask[],
  attempts: QuizAttempt[],
  today: Date,
): WeeklySummary {
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const startKey = toISODate(start);
  const lastStartKey = toISODate(subWeeks(start, 1));
  const todayKey = toISODate(today);
  const inThis = (d: string) => d >= startKey && d <= todayKey;
  const inLast = (d: string) => d >= lastStartKey && d < startKey;

  const thisTasks = tasks.filter((t) => inThis(t.date));
  const lastTasks = tasks.filter((t) => inLast(t.date));
  const thisAttempts = attempts.filter((a) => inThis(localDate(a.takenAt)));
  const lastAttempts = attempts.filter((a) => inLast(localDate(a.takenAt)));

  const practised = new Map<string, TopicRef>();
  thisAttempts.forEach((a) => practised.set(topicKey(a.subjectId, a.topicId), a));

  const before = latestAttemptByTopic(attempts.filter((a) => localDate(a.takenAt) < startKey));
  const nowLatest = latestAttemptByTopic(thisAttempts);
  const improved: WeeklySummary["improved"] = [];
  nowLatest.forEach((a, key) => {
    const prev = before.get(key);
    if (prev && percentOf(a) > percentOf(prev)) {
      improved.push({
        subjectId: a.subjectId,
        topicId: a.topicId,
        from: percentOf(prev),
        to: percentOf(a),
      });
    }
  });

  return {
    weekStart: startKey,
    thisWeek: statsFor(thisTasks, thisAttempts),
    lastWeek: statsFor(lastTasks, lastAttempts),
    topicsPractised: [...practised.values()].map(({ subjectId, topicId }) => ({
      subjectId,
      topicId,
    })),
    improved: improved.sort((x, y) => y.to - y.from - (x.to - x.from)),
    includesDemo:
      thisTasks.some((t) => isDemoRecord(t.id)) ||
      thisAttempts.some((a) => a.isDemo) ||
      lastTasks.some((t) => isDemoRecord(t.id)) ||
      lastAttempts.some((a) => a.isDemo),
  };
}
