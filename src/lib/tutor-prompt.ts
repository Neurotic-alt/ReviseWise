import type { CompanionMode } from "./companion";
import type { QuizQuestion, SubjectId } from "./data/types";
import { getExam, type ExamId } from "./study-context";

// Prompt building and reply parsing for the AI tutor. Pure and browser-safe,
// so the server function and the tests share exactly the same rules.

/** Primary model on Google's API with GEMINI_API_KEY; the gateway (LOVABLE_API_KEY) is the backup. */
export const GEMINI_DIRECT_MODELS = ["gemini-3-flash-preview"] as const;
/** How long each direct Gemini attempt may take before moving on (Companion replies). */
export const GEMINI_DIRECT_TIMEOUT_MS = 8_000;
/** Quizzes take longer: every question comes with a worked, step-by-step solution. */
export const QUIZ_DIRECT_TIMEOUT_MS = 20_000;

/** Gemini 3 models think by default; a low level keeps answers accurate but quick. */
export function geminiThinking(model: string): { thinkingConfig?: { thinkingLevel: "low" } } {
  return model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "low" } } : {};
}
/** Same model through the Lovable AI Gateway (backup route). */
export const GEMINI_GATEWAY_MODEL = "google/gemini-3-flash-preview";

export const MAX_QUESTION_CHARS = 1500;
export const MAX_HISTORY_MESSAGES = 8;

export interface TutorProfile {
  yearGroup: string;
  curriculum: string;
  country: string;
  language: string;
  explanationStyle: "step-by-step" | "concise" | "visual";
}

export interface TutorTurn {
  role: "student" | "companion";
  text: string;
}

export interface TutorRequest {
  question: string;
  subjectName: string;
  /** Missing when the student typed their own subject. */
  subjectId?: SubjectId | undefined;
  topicName?: string | undefined;
  exam?: ExamId | undefined;
  mode: CompanionMode;
  profile: TutorProfile;
  history: TutorTurn[];
}

const STYLE: Record<TutorProfile["explanationStyle"], string> = {
  "step-by-step": "Explain step by step, showing the reasoning for each step.",
  concise: "Keep it short and to the point.",
  visual: "Use concrete examples, analogies and simple text diagrams where they help.",
};

const MODE_RULES: Record<CompanionMode, string> = {
  explain:
    "MODE: Explanation. Give a clear explanation: the big idea in one sentence, key terms, a short worked example, one common mistake, and end with one quick check question.",
  hint:
    "MODE: Hint. Do NOT give the final answer or solve the problem. Give one or two guiding hints or questions that move the student to the next step only.",
  practice:
    "MODE: Test me. Write ONE multiple-choice question that tests the topic the student mentions, with exactly four options, one correct answer and a short explanation.",
  summarise:
    "MODE: Summary. Summarise the topic in one line, then three to five key points, then one link to something related the student may already know.",
};

/** Normalised language name for the instruction, e.g. "हिन्दी (Hindi)" -> "Hindi". */
export function languageName(setting: string) {
  const inParens = setting.match(/\(([^)]+)\)/);
  return (inParens?.[1] ?? setting).trim() || "English";
}

export function buildSystemPrompt(
  req: Pick<TutorRequest, "subjectName" | "mode" | "profile" | "topicName" | "exam">,
) {
  const p = req.profile;
  const exam = req.exam ? getExam(req.exam) : null;
  return [
    "You are ReviseWise, a friendly, encouraging study tutor for school and college students.",
    `Subject: ${req.subjectName}.${req.topicName ? ` Topic: ${req.topicName}.` : ""}`,
    exam
      ? `Student: ${p.yearGroup}, preparing for ${exam.label}. ${exam.focus}`
      : `Student: ${p.yearGroup}, ${p.curriculum} curriculum, ${p.country}.`,
    `Reply in ${languageName(p.language)}.`,
    STYLE[p.explanationStyle],
    MODE_RULES[req.mode],
    "Match the level to the student's year group and curriculum. Be accurate; if you are unsure, say so.",
    "Format as plain text. You may use short '- ' bullet lines, numbered lines and **bold** for key terms. No headings, tables or code blocks unless the subject needs them.",
    "Keep replies under about 220 words.",
    "Stay on schoolwork. If asked for something unsafe, unkind or unrelated to learning, gently steer back to studying. Never ask for personal information.",
  ].join("\n");
}

/** JSON schema for a "Test me" reply. */
export const PRACTICE_SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string" },
    prompt: { type: "string" },
    options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
    answerIndex: { type: "integer", minimum: 0, maximum: 3 },
    explanation: { type: "string" },
  },
  required: ["intro", "prompt", "options", "answerIndex", "explanation"],
  additionalProperties: false,
} as const;

/** Validates a "Test me" reply; returns null when the model output is unusable. */
export function parsePracticeReply(
  raw: string,
  subjectId: SubjectId | undefined,
  subjectLabel?: string,
): { intro: string; question: QuizQuestion } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const options = d["options"];
  const answerIndex = d["answerIndex"];
  if (
    typeof d["prompt"] !== "string" ||
    !Array.isArray(options) ||
    options.length !== 4 ||
    !options.every((o) => typeof o === "string" && o.trim()) ||
    typeof answerIndex !== "number" ||
    !Number.isInteger(answerIndex) ||
    answerIndex < 0 ||
    answerIndex > 3 ||
    new Set(options).size !== 4
  ) {
    return null;
  }
  return {
    intro: typeof d["intro"] === "string" && d["intro"].trim() ? d["intro"] : "Here's a question for you.",
    question: {
      id: `ai-${Math.random().toString(36).slice(2, 10)}`,
      subjectId: subjectId ?? "maths",
      ...(subjectId ? {} : { subjectLabel: subjectLabel ?? "Custom subject" }),
      topicId: "ai",
      difficulty: "medium",
      prompt: d["prompt"],
      options: options as string[],
      answerIndex,
      explanation: typeof d["explanation"] === "string" ? d["explanation"] : "",
    },
  };
}

/** Last few turns, trimmed, oldest first. */
export function trimHistory(history: TutorTurn[]) {
  return history
    .filter((t) => t.text.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_QUESTION_CHARS) }));
}
