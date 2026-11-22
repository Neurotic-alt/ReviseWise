import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import type { ExamDate, StudyTask } from "./data/types";

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");

/** Seven days, Monday first, for the week containing `anchor`. */
export function getWeekDays(anchor: Date): Date[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function tasksOn(tasks: StudyTask[], date: string) {
  return tasks.filter((t) => t.date === date);
}

export function completionPercent(tasks: StudyTask[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

/** Calendar days from `today` until the exam; negative once it has passed. */
export function daysUntil(examDate: string, today: Date) {
  return differenceInCalendarDays(parseISO(examDate), today);
}

export function upcomingExams(exams: ExamDate[], today: Date) {
  return exams
    .filter((e) => daysUntil(e.date, today) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
