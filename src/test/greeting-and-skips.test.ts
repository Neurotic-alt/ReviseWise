import { describe, expect, it } from "vitest";
import { accountName, greetingName } from "@/lib/greeting";
import { recordQuiz } from "@/lib/data/actions";
import { markQuiz, questionMarks } from "@/lib/quiz";
import { markingFor } from "@/lib/study-context";

describe("Dashboard greeting", () => {
  it("says Student when signed out", () => {
    expect(greetingName({ signedIn: false, settingsName: "Priya", accountName: "Priya Shah" })).toBe("Student");
  });
  it("uses the signed-in student's account name", () => {
    expect(greetingName({ signedIn: true, accountName: accountName({ full_name: "Priya Shah" }) })).toBe("Priya");
  });
  it("never greets with the old placeholder Alex", () => {
    expect(greetingName({ signedIn: true, settingsName: "Alex", accountName: "Rahul Verma" })).toBe("Rahul");
    expect(greetingName({ signedIn: true, settingsName: "Alex" })).toBe("Student");
  });
  it("prefers the display name set in Settings", () => {
    expect(greetingName({ signedIn: true, settingsName: "Ria", accountName: "Riya Kapoor" })).toBe("Ria");
  });
  it("falls back to the email name", () => {
    expect(greetingName({ signedIn: true, email: "arjun.k@example.com" })).toBe("Arjun");
  });
});

describe("Skipped questions", () => {
  const q = (id: string) => ({
    id, subjectId: "physics" as const, topicId: "forces", difficulty: "easy" as const,
    prompt: "?", options: ["a", "b", "c", "d"], answerIndex: 0, explanation: "",
  });
  const qs = [q("s1"), q("s2"), q("s3")];

  it("score 0 marks in JEE — neither +4 nor -1", () => {
    expect(questionMarks(q("x"), undefined, markingFor("jee"))).toBe(0);
  });

  it("1 right, 1 wrong, 1 skipped in JEE is 3/12 with the skip counted as skipped", () => {
    expect(markQuiz(qs, { s1: 0, s2: 2 }, markingFor("jee"))).toMatchObject({
      marks: 3, maxMarks: 12, correct: 1, wrong: 1, unanswered: 1,
    });
  });

  it("are saved to My Progress as skipped, not wrong", () => {
    const [saved] = recordQuiz(qs, { s1: 0, s2: 2 }, {
      difficulty: "easy", source: "studio", marking: markingFor("jee"), exam: "JEE",
    });
    expect(saved).toMatchObject({ correct: 1, wrong: 1, skipped: 1, marks: 3, maxMarks: 12 });
  });
});
