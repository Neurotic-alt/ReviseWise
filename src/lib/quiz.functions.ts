import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SUBJECTS } from "./data/subjects";
import { buildQuizPrompt, parseQuizReply, type QuizTopicRequest } from "./quiz-ai";
import { EXAM_IDS, MAX_CUSTOM_CHARS, levelFor } from "./study-context";
import type { QuizQuestion, SubjectId } from "./data/types";

const subjectIds = SUBJECTS.map((s) => s.id) as [SubjectId, ...SubjectId[]];
const name = z.string().trim().min(1).max(MAX_CUSTOM_CHARS);

const inputSchema = z.object({
  topics: z
    .array(
      z.object({
        subjectId: z.enum(subjectIds).optional(),
        subjectName: name,
        topicId: name,
        topicName: name,
        difficulty: z.enum(["easy", "medium", "hard"]),
      }),
    )
    .min(1)
    .max(10),
  count: z.number().int().min(1).max(15),
  exam: z.enum(EXAM_IDS),
  level: z.string().max(40),
});

export type GenerateQuizResult = { ok: true; questions: QuizQuestion[] } | { ok: false };

/** Generates a live AI quiz. Public: no sign-in yet; inputs validated and capped. */
export const generateQuizFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<GenerateQuizResult> => {
    const topics: QuizTopicRequest[] = data.topics;
    try {
      const { generateQuizText } = await import("./quiz-ai.server");
      const audience = { exam: data.exam, level: levelFor(data.exam, data.level) };
      const raw = await generateQuizText(buildQuizPrompt(topics, data.count, audience));
      const questions = parseQuizReply(raw, topics, data.count);
      return questions.length ? { ok: true, questions } : { ok: false };
    } catch (e) {
      console.error("[quiz] generation failed:", String(e));
      return { ok: false };
    }
  });
