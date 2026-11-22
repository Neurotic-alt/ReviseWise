import { QUESTION_BANK } from "./data/question-bank";
import { getSubject } from "./data/subjects";
import type { QuizQuestion, SubjectId } from "./data/types";

export type CompanionMode = "explain" | "hint" | "practice" | "summarise";

export const COMPANION_MODES: { id: CompanionMode; label: string; description: string }[] = [
  { id: "explain", label: "Explanation", description: "Step-by-step breakdown of a concept" },
  { id: "hint", label: "Hint", description: "A nudge in the right direction, no full answer" },
  { id: "practice", label: "Practice", description: "A question to test yourself" },
  { id: "summarise", label: "Summary", description: "The key points in a few lines" },
];

/** One-click actions that send the current question in a given mode. */
export const QUICK_ACTIONS: { mode: CompanionMode; label: string }[] = [
  { mode: "explain", label: "Explain this" },
  { mode: "hint", label: "Give me a hint" },
  { mode: "practice", label: "Test me" },
  { mode: "summarise", label: "Summarise this" },
];

export const isCompanionMode = (v: unknown): v is CompanionMode =>
  v === "explain" || v === "hint" || v === "practice" || v === "summarise";

export interface ChatMessage {
  id: string;
  role: "student" | "companion";
  text: string;
  mode?: CompanionMode;
  subjectId?: SubjectId;
  /** Typed subject name when the student chose "Other". */
  subjectLabel?: string;
  /** Topic the message was about, if one was picked or typed. */
  topicLabel?: string;
  practice?: QuizQuestion;
  /** The student question a companion reply answers, so quick actions can reuse it. */
  question?: string;
  /** True for pre-written sample replies, used only when the AI tutor can't be reached. */
  isDemo?: boolean;
  /** Set on sample replies shown because the AI tutor was unavailable. */
  aiUnavailable?: boolean;
}

/**
 * Returns a pre-written sample reply. This is NOT an AI response; it is shown only
 * when the AI tutor can't be reached, and the UI labels it as a sample.
 */
export function demoCompanionReply(
  question: string,
  subjectId: SubjectId,
  mode: CompanionMode,
  turn: number,
): Omit<ChatMessage, "id"> {
  const subject = getSubject(subjectId).name;
  const topic = question.trim().replace(/[?.!]+$/, "") || `this ${subject} topic`;

  if (mode === "practice") {
    // Prefer a topic the student named, e.g. "test me on electricity".
    const lower = question.toLowerCase();
    const named = getSubject(subjectId).topics.find((t) =>
      t.name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((w) => w.length > 3 && lower.includes(w)),
    );
    const subjectPool = QUESTION_BANK.filter((q) => q.subjectId === subjectId);
    const topicPool = named ? subjectPool.filter((q) => q.topicId === named.id) : [];
    const pool = topicPool.length ? topicPool : subjectPool;
    const practice = pool[turn % pool.length];
    return {
      role: "companion",
      mode,
      subjectId,
      isDemo: true,
      question,
      ...(practice ? { practice } : {}),
      text: `Here's a ${subject} practice question from the sample bank. Pick an answer, then reveal the explanation.`,
    };
  }

  if (mode === "summarise") {
    return {
      role: "companion",
      mode,
      subjectId,
      isDemo: true,
      question,
      text: [
        `How a summary of “${topic}” will be laid out:`,
        `• In one line — the core idea of this ${subject} topic.`,
        `• Three key points — the facts or rules you must remember.`,
        `• One link — how it connects to something you already know.`,
        `This is a sample layout only, shown because the AI tutor couldn't be reached.`,
      ].join("\n"),
    };
  }

  if (mode === "hint") {
    return {
      role: "companion",
      mode,
      subjectId,
      isDemo: true,
      question,
      text: [
        `Hint for “${topic}”:`,
        `• What is the question really asking you to find?`,
        `• Which ${subject} rule, formula or idea connects what you know to what you need?`,
        `• Try writing down the first step only — then check whether it moves you closer.`,
        `This is a sample hint, shown because the AI tutor couldn't be reached.`,
      ].join("\n"),
    };
  }

  return {
    role: "companion",
    mode,
    subjectId,
    isDemo: true,
    question,
    text: [
      `How an explanation of “${topic}” will be laid out:`,
      `1. The big idea — a one-sentence summary in plain language.`,
      `2. Key terms — the ${subject} vocabulary you need, defined simply.`,
      `3. Worked example — solved step by step, with the reasoning shown.`,
      `4. Common mistakes — what examiners often see students get wrong.`,
      `5. Quick check — one question to confirm you've got it.`,
      `This is a sample layout only, shown because the AI tutor couldn't be reached.`,
    ].join("\n"),
  };
}

export const STARTER_PROMPTS: Record<SubjectId, string[]> = {
  maths: ["How do I factorise quadratics?", "Explain Pythagoras' theorem"],
  physics: ["What is Newton's second law?", "How do parallel circuits work?"],
  biology: ["What does the mitochondria do?", "Explain osmosis"],
  chemistry: ["How do I balance equations?", "What are isotopes?"],
  english: ["What is dramatic irony?", "When do I use a semicolon?"],
  history: ["What caused World War I?", "Why was the Civil Rights Act important?"],
};
