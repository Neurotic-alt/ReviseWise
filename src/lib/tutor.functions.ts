import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SUBJECTS } from "./data/subjects";
import { EXAM_IDS, MAX_CUSTOM_CHARS } from "./study-context";
import { EXPLANATION_MODES, MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS, parsePracticeReply } from "./tutor-prompt";
import type { QuizQuestion, SubjectId } from "./data/types";

const subjectIds = SUBJECTS.map((s) => s.id) as [SubjectId, ...SubjectId[]];

export const tutorInputSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
  subjectId: z.enum(subjectIds).optional(),
  /** Typed subject name; used when subjectId is missing. */
  subjectName: z.string().trim().max(MAX_CUSTOM_CHARS).optional(),
  topicName: z.string().trim().max(MAX_CUSTOM_CHARS).optional(),
  exam: z.enum(EXAM_IDS).optional(),
  explanationMode: z.enum(EXPLANATION_MODES).optional(),
  mode: z.enum(["explain", "hint", "practice", "summarise"]),
  profile: z.object({
    yearGroup: z.string().max(40),
    curriculum: z.string().max(60),
    country: z.string().max(60),
    language: z.string().max(60),
    explanationStyle: z.enum(["step-by-step", "concise", "visual"]),
  }),
  history: z
    .array(z.object({ role: z.enum(["student", "companion"]), text: z.string().max(MAX_QUESTION_CHARS) }))
    .max(MAX_HISTORY_MESSAGES * 2),
});

export type AskTutorResult =
  | { ok: true; text: string; practice?: QuizQuestion; route: "gemini" | "gateway" }
  | { ok: false; error: "unavailable" | "bad-practice" };

/** Asks the AI tutor (Gemini). Public: no sign-in exists yet, inputs are validated and capped. */
export const askTutorFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tutorInputSchema.parse(data))
  .handler(async ({ data }): Promise<AskTutorResult> => {
    const { askTutor } = await import("./tutor.server");
    const subjectName =
      SUBJECTS.find((s) => s.id === data.subjectId)?.name ?? (data.subjectName || "General studies");
    try {
      const { text, route } = await askTutor({ ...data, subjectName });
      if (data.mode === "practice") {
        const parsed = parsePracticeReply(text, data.subjectId, subjectName);
        if (!parsed) return { ok: false, error: "bad-practice" };
        return { ok: true, text: parsed.intro, practice: parsed.question, route };
      }
      return { ok: true, text, route };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
