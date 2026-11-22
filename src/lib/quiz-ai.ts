import type { Difficulty, QuizQuestion, SubjectId } from "./data/types";
import { getExam, type ExamId } from "./study-context";
import { GEMINI_GATEWAY_MODEL } from "./tutor-prompt";

// Prompt + parsing for AI-generated quizzes. Pure and browser-safe.

/** Lovable AI Gateway model used when every direct Gemini model fails. */
export const QUIZ_GATEWAY_MODEL = GEMINI_GATEWAY_MODEL;
/** Placeholder subject id stored on questions for a typed subject (see subjectLabel). */
export const CUSTOM_SUBJECT_PLACEHOLDER: SubjectId = "maths";

export interface QuizTopicRequest {
  /** Missing for a subject the student typed. */
  subjectId?: SubjectId | undefined;
  subjectName: string;
  topicId: string;
  topicName: string;
  difficulty: Difficulty;
}

export const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicIndex: { type: "integer" },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          answerIndex: { type: "integer", minimum: 0, maximum: 3 },
          steps: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
          explanation: { type: "string" },
        },
        required: ["topicIndex", "prompt", "options", "answerIndex", "steps", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

export interface QuizAudience {
  exam: ExamId;
  level: string;
}

export function buildQuizPrompt(topics: QuizTopicRequest[], count: number, audience: QuizAudience) {
  const exam = getExam(audience.exam);
  const list = topics
    .map((t, i) => `${i}. ${t.subjectName} — ${t.topicName} (difficulty: ${t.difficulty})`)
    .join("\n");
  return [
    `Write exactly ${count} multiple-choice revision questions for a ${exam.label} student (${audience.level}).`,
    exam.focus,
    "Spread the questions across these topics as evenly as possible; set topicIndex to the topic's number:",
    list,
    "Each question has exactly four distinct options and one correct answerIndex (0-3).",
    "steps: ALWAYS give a worked solution in 2-5 short steps (no numbering) that a student can follow from the question to the correct answer, showing any formula, rule or calculation used. Never leave steps empty.",
    "explanation: one sentence on why the answer is correct and why the most tempting wrong option is wrong.",
    "Be accurate and match the stated difficulty. Vary the position of the correct answer. Reply with JSON only.",
  ].join("\n");
}

export function parseQuizReply(raw: string, topics: QuizTopicRequest[], count: number): QuizQuestion[] {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return [];
  }
  const items = (data as { questions?: unknown })?.questions;
  if (!Array.isArray(items)) return [];
  const out: QuizQuestion[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const options = d["options"];
    const answerIndex = d["answerIndex"];
    if (
      typeof d["prompt"] !== "string" ||
      !d["prompt"].trim() ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      !options.every((o) => typeof o === "string" && o.trim()) ||
      new Set(options).size !== 4 ||
      typeof answerIndex !== "number" ||
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex > 3
    )
      continue;
    const ti = typeof d["topicIndex"] === "number" ? d["topicIndex"] : 0;
    const topic = topics[ti] ?? topics[0];
    if (!topic) continue;
    out.push({
      id: `ai-${Math.random().toString(36).slice(2, 10)}`,
      subjectId: topic.subjectId ?? CUSTOM_SUBJECT_PLACEHOLDER,
      topicId: topic.topicId,
      ...(topic.subjectId ? {} : { subjectLabel: topic.subjectName }),
      difficulty: topic.difficulty,
      prompt: d["prompt"],
      options: options as string[],
      answerIndex,
      explanation: typeof d["explanation"] === "string" ? d["explanation"] : "",
      steps: cleanSteps(d["steps"]),
    });
  }
  return out.slice(0, count);
}

/** Keeps non-empty step strings, without any "Step 1:" / "1." prefix the model added. */
function cleanSteps(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^\s*(?:step\s*)?\d+\s*[.):-]\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}
