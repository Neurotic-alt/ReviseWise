import { describe, expect, it } from "vitest";
import { buildQuizPrompt, parseQuizReply } from "@/lib/quiz-ai";
import { CUSTOM, EXAMS, examFromLabel, levelFor, resolveStudy, type StudyChoice } from "@/lib/study-context";

const base: StudyChoice = {
  exam: "cbse",
  level: "Class 10",
  subject: "maths",
  customSubject: "",
  topic: "algebra",
  customTopic: "",
};

describe("Exam / Curriculum options", () => {
  it("offers exactly the eight requested exams", () => {
    expect(EXAMS.map((e) => e.label)).toEqual([
      "CBSE",
      "ICSE",
      "Maharashtra State Board",
      "JEE",
      "NEET",
      "MHT-CET",
      "CUET",
      "General / University",
    ]);
  });

  it("keeps a class the exam offers and swaps in the default otherwise", () => {
    expect(levelFor("jee", "Class 11")).toBe("Class 11");
    expect(levelFor("jee", "Class 8")).toBe("Class 12");
    expect(levelFor("general", "Class 10")).toBe("Undergraduate");
  });

  it("falls back to CBSE for an unknown saved curriculum", () => {
    expect(examFromLabel("NEET")).toBe("neet");
    expect(examFromLabel("GCSE")).toBe("cbse");
  });
});

describe("Subject and topic choice", () => {
  it("uses a picked subject and topic", () => {
    const r = resolveStudy(base, { topicRequired: true });
    expect(r).toEqual({
      ok: true,
      value: { subjectId: "maths", subjectName: "Mathematics", topicId: "algebra", topicName: "Algebra" },
    });
  });

  it("accepts a typed subject and topic", () => {
    const r = resolveStudy(
      { ...base, subject: CUSTOM, customSubject: " Accountancy ", topic: CUSTOM, customTopic: "Partnership" },
      { topicRequired: true },
    );
    expect(r.ok && r.value).toEqual({
      subjectId: null,
      subjectName: "Accountancy",
      topicId: "Partnership",
      topicName: "Partnership",
    });
  });

  it("rejects an empty typed subject", () => {
    const r = resolveStudy({ ...base, subject: CUSTOM }, { topicRequired: false });
    expect(r.ok).toBe(false);
  });

  it("requires a topic for quizzes but not for the companion", () => {
    const c = { ...base, topic: CUSTOM, customTopic: "  " };
    expect(resolveStudy(c, { topicRequired: true }).ok).toBe(false);
    expect(resolveStudy(c, { topicRequired: false }).ok).toBe(true);
  });
});

describe("AI quiz prompt and parsing", () => {
  const topic = { subjectName: "Accountancy", topicId: "Partnership", topicName: "Partnership", difficulty: "medium" as const };

  it("names the exam and class in the prompt", () => {
    const p = buildQuizPrompt([topic], 5, { exam: "neet", level: "Class 12" });
    expect(p).toContain("NEET student (Class 12)");
    expect(p).toContain("Accountancy — Partnership");
  });

  it("labels questions on a typed subject", () => {
    const raw = JSON.stringify({
      questions: [{ topicIndex: 0, prompt: "Q?", options: ["a", "b", "c", "d"], answerIndex: 2, explanation: "e" }],
    });
    const [q] = parseQuizReply(raw, [topic], 5);
    expect(q?.subjectLabel).toBe("Accountancy");
    expect(q?.topicId).toBe("Partnership");
  });
});

import { customSubjectStats } from "@/lib/progress";

describe("My Progress: typed subjects", () => {
  const at = (d: number) => new Date(2026, 10, d, 12).toISOString();
  it("groups by subject name ignoring case, with average and latest score", () => {
    const stats = customSubjectStats([
      { id: "1", subjectName: "Accountancy", topicName: "Partnership", difficulty: "medium", correct: 2, total: 4, takenAt: at(10) },
      { id: "2", subjectName: "accountancy ", topicName: "Goodwill", difficulty: "medium", correct: 4, total: 4, takenAt: at(12) },
      { id: "3", subjectName: "Economics", topicName: "Demand", difficulty: "easy", correct: 1, total: 5, takenAt: at(11) },
    ]);
    expect(stats.map((s) => s.subjectName)).toEqual(["accountancy", "Economics"]);
    expect(stats[0]).toMatchObject({ quizzes: 2, averagePercent: 75, latestPercent: 100, topics: ["Goodwill", "Partnership"] });
    expect(stats[1]).toMatchObject({ quizzes: 1, averagePercent: 20 });
  });
});

import { markQuiz, questionMarks } from "@/lib/quiz";
import { hasNegativeMarking, markingFor, quizMarkingFor } from "@/lib/study-context";
import { GEMINI_DIRECT_MODELS, GEMINI_GATEWAY_MODEL } from "@/lib/tutor-prompt";

describe("Gemini model order", () => {
  it("uses gemini-3-flash-preview first on the Gemini key", () => {
    expect([...GEMINI_DIRECT_MODELS]).toEqual(["gemini-3-flash-preview"]);
  });
  it("backs up with the same model through Lovable AI", () => {
    expect(GEMINI_GATEWAY_MODEL).toBe("google/gemini-3-flash-preview");
  });
});

describe("Exam marking", () => {
  it("is +4 / -1 for JEE and NEET", () => {
    for (const exam of ["jee", "neet"] as const) {
      expect(markingFor(exam)).toEqual({ correct: 4, wrong: -1 });
      expect(hasNegativeMarking(exam)).toBe(true);
    }
  });

  it("is +1 / 0 with no negative marking for MHT-CET and board exams", () => {
    for (const exam of ["mht-cet", "cbse", "icse", "maharashtra"] as const) {
      expect(markingFor(exam)).toEqual({ correct: 1, wrong: 0 });
      expect(hasNegativeMarking(exam)).toBe(false);
    }
  });

  it("keeps +4 but takes nothing off when a JEE student switches negative marking off", () => {
    expect(quizMarkingFor("jee", false)).toEqual({ correct: 4, wrong: 0 });
    expect(quizMarkingFor("jee", true)).toEqual({ correct: 4, wrong: -1 });
  });

  it("never adds negative marking to MHT-CET", () => {
    expect(quizMarkingFor("mht-cet", true)).toEqual({ correct: 1, wrong: 0 });
  });

  it("scores MHT-CET 2 right, 1 wrong, 1 skipped as 2 out of 4", () => {
    const qq = (id: string) => ({
      id, subjectId: "maths" as const, topicId: "t", difficulty: "easy" as const,
      prompt: "?", options: ["a", "b", "c", "d"], answerIndex: 0, explanation: "",
    });
    const r = markQuiz([qq("1"), qq("2"), qq("3"), qq("4")], { "1": 0, "2": 0, "3": 2 }, markingFor("mht-cet"));
    expect(r).toMatchObject({ marks: 2, maxMarks: 4 });
  });

  const q = (id: string) => ({
    id, subjectId: "maths" as const, topicId: "t", difficulty: "easy" as const,
    prompt: "?", options: ["a", "b", "c", "d"], answerIndex: 0, explanation: "",
  });
  const qs = [q("1"), q("2"), q("3"), q("4")];
  const marking = { correct: 4, wrong: -1 };

  it("scores 2 right, 1 wrong, 1 skipped as 7 out of 16", () => {
    expect(markQuiz(qs, { "1": 0, "2": 0, "3": 2 }, marking)).toEqual({
      marks: 7, maxMarks: 16, correct: 2, wrong: 1, unanswered: 1, percent: 44,
    });
  });

  it("gives 0 for a skipped question and allows a negative total", () => {
    expect(questionMarks(q("x"), undefined, marking)).toBe(0);
    const r = markQuiz(qs, { "1": 1, "2": 1 }, marking);
    expect(r.marks).toBe(-2);
    expect(r.percent).toBe(0);
  });
});

describe("Step-by-step solutions", () => {
  const topic = { subjectName: "Physics", topicId: "Optics", topicName: "Optics", difficulty: "hard" as const };
  it("asks the AI for worked steps", () => {
    expect(buildQuizPrompt([topic], 3, { exam: "jee", level: "Class 12" })).toContain("steps:");
  });
  it("keeps each step and strips numbering the model added", () => {
    const raw = JSON.stringify({
      questions: [{ topicIndex: 0, prompt: "Q?", options: ["a", "b", "c", "d"], answerIndex: 1,
        steps: ["Step 1: Use the lens formula", "2. Put in u = -20 cm", "", "Solve for v"], explanation: "e" }],
    });
    expect(parseQuizReply(raw, [topic], 3)[0]?.steps).toEqual(["Use the lens formula", "Put in u = -20 cm", "Solve for v"]);
  });
});
