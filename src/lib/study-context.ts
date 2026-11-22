import { SUBJECTS } from "./data/subjects";
import type { SubjectId } from "./data/types";

// Exam / curriculum, class level and subject-topic choices shared by Quiz Studio and
// the AI Companion. Pure and browser-safe so the server and tests use the same rules.

/** Marks per question in an exam with negative marking. */
export interface Marking {
  correct: number;
  wrong: number;
}
/** Standard entrance-exam scheme: +4 for a correct answer, −1 for a wrong one, 0 if skipped. */
export const NEGATIVE_MARKING: Marking = { correct: 4, wrong: -1 };

const SCHOOL_CLASSES = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];

export const EXAMS = [
  {
    id: "cbse",
    marking: null,
    label: "CBSE",
    levels: SCHOOL_CLASSES,
    defaultLevel: "Class 10",
    focus: "Follow the CBSE syllabus and NCERT textbooks, in the style of CBSE board exam questions.",
  },
  {
    id: "icse",
    marking: null,
    label: "ICSE",
    levels: SCHOOL_CLASSES,
    defaultLevel: "Class 10",
    focus: "Follow the CISCE syllabus (ICSE for Class 10, ISC for Class 11-12) and its board exam style.",
  },
  {
    id: "maharashtra",
    marking: null,
    label: "Maharashtra State Board",
    levels: SCHOOL_CLASSES,
    defaultLevel: "Class 10",
    focus:
      "Follow the Maharashtra State Board (MSBSHSE) syllabus and Balbharati textbooks, in the style of SSC/HSC board questions.",
  },
  {
    id: "jee",
    marking: NEGATIVE_MARKING,
    label: "JEE",
    levels: ["Class 11", "Class 12", "Dropper / Repeat year"],
    defaultLevel: "Class 12",
    focus:
      "Target JEE Main and Advanced (Physics, Chemistry, Mathematics) on the NCERT Class 11-12 syllabus, with exam-level problem solving.",
  },
  {
    id: "neet",
    marking: NEGATIVE_MARKING,
    label: "NEET",
    levels: ["Class 11", "Class 12", "Dropper / Repeat year"],
    defaultLevel: "Class 12",
    focus:
      "Target NEET-UG (Physics, Chemistry, Biology) strictly on the NCERT Class 11-12 syllabus, in the NTA question style.",
  },
  {
    id: "mht-cet",
    marking: NEGATIVE_MARKING,
    label: "MHT-CET",
    levels: ["Class 11", "Class 12", "Dropper / Repeat year"],
    defaultLevel: "Class 12",
    focus:
      "Target MHT-CET (PCM/PCB) on the Maharashtra State Board Class 11-12 syllabus, in the CET exam style.",
  },
  {
    id: "cuet",
    marking: null,
    label: "CUET",
    levels: ["Class 12", "Gap year"],
    defaultLevel: "Class 12",
    focus: "Target CUET-UG domain subjects on the NCERT Class 12 syllabus, in the NTA question style.",
  },
  {
    id: "general",
    marking: null,
    label: "General / University",
    levels: ["School (general)", "Undergraduate", "Postgraduate", "Self-learner"],
    defaultLevel: "Undergraduate",
    focus: "Not tied to a specific board; match the student's level.",
  },
] as const;

export type ExamId = (typeof EXAMS)[number]["id"];
export const EXAM_IDS = EXAMS.map((e) => e.id) as [ExamId, ...ExamId[]];

export function getExam(id: ExamId) {
  return EXAMS.find((e) => e.id === id) ?? EXAMS[0];
}

/** The exam's negative-marking scheme, or null when it has none. */
export function markingFor(id: ExamId): Marking | null {
  return getExam(id).marking;
}

export function isExamId(v: unknown): v is ExamId {
  return EXAMS.some((e) => e.id === v);
}

/** Keeps a saved level when the exam offers it, otherwise uses the exam's default level. */
export function levelFor(exam: ExamId, level: string | undefined): string {
  const e = getExam(exam);
  return level && (e.levels as readonly string[]).includes(level) ? level : e.defaultLevel;
}

/** Finds the exam matching a saved curriculum label, falling back to CBSE. */
export function examFromLabel(label: string | undefined): ExamId {
  return EXAMS.find((e) => e.label.toLowerCase() === label?.trim().toLowerCase())?.id ?? "cbse";
}

export const CUSTOM = "__custom";
export const ANY_TOPIC = "__any";
export const MAX_CUSTOM_CHARS = 80;

export interface StudyChoice {
  exam: ExamId;
  level: string;
  /** A built-in subject id, or CUSTOM for a typed subject. */
  subject: SubjectId | typeof CUSTOM;
  customSubject: string;
  /** A built-in topic id, CUSTOM for a typed topic, or ANY_TOPIC (companion only). */
  topic: string;
  customTopic: string;
}

export interface ResolvedStudy {
  /** Null for a typed (custom) subject. */
  subjectId: SubjectId | null;
  subjectName: string;
  /** Built-in topic id, the typed topic name, or null for "any topic". */
  topicId: string | null;
  topicName: string | null;
}

export type ResolveResult = { ok: true; value: ResolvedStudy } | { ok: false; error: string };

const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_CHARS);

/** Turns the picker state into subject/topic names; a typed value must not be empty. */
export function resolveStudy(c: StudyChoice, opts: { topicRequired: boolean }): ResolveResult {
  let subjectId: SubjectId | null = null;
  let subjectName: string;
  if (c.subject === CUSTOM) {
    subjectName = clean(c.customSubject);
    if (!subjectName) return { ok: false, error: "Type a subject name." };
  } else {
    const s = SUBJECTS.find((x) => x.id === c.subject);
    if (!s) return { ok: false, error: "Pick a subject." };
    subjectId = s.id;
    subjectName = s.name;
  }

  const builtIn =
    subjectId && c.topic !== CUSTOM && c.topic !== ANY_TOPIC
      ? SUBJECTS.find((s) => s.id === subjectId)?.topics.find((t) => t.id === c.topic)
      : undefined;
  if (builtIn) return { ok: true, value: { subjectId, subjectName, topicId: builtIn.id, topicName: builtIn.name } };

  const typed = clean(c.customTopic);
  const wantsTyped = c.topic === CUSTOM || !subjectId;
  if (wantsTyped && typed) return { ok: true, value: { subjectId, subjectName, topicId: typed, topicName: typed } };
  if (opts.topicRequired) return { ok: false, error: "Type a topic name." };
  return { ok: true, value: { subjectId, subjectName, topicId: null, topicName: null } };
}
