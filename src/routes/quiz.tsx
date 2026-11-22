import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Dices,
  Loader2,
  Lightbulb,
  MessageSquareText,
  RotateCcw,
  SkipForward,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SubjectTag } from "@/components/app/common";
import { StudyContextFields, useStudyChoice } from "@/components/app/StudyContextFields";
import { recordCustomQuiz, recordQuiz } from "@/lib/data/actions";
import { quizAttemptsStore } from "@/lib/data/stores";
import { SUBJECTS, getSubject, getTopicName } from "@/lib/data/subjects";
import {
  getExam,
  hasNegativeMarking,
  markingFor,
  quizMarkingFor,
  resolveStudy,
  type Marking,
} from "@/lib/study-context";
import type { Difficulty, QuizQuestion, SubjectId } from "@/lib/data/types";
import { SURPRISE_QUESTION_COUNT, revisionDue, weakAreas } from "@/lib/learning";
import { generateQuizFn } from "@/lib/quiz.functions";
import {
  DIFFICULTIES,
  QUESTION_COUNTS,
  markQuiz,
  questionMarks,
  scoreBand,
} from "@/lib/quiz";
import { cn } from "@/lib/utils";

interface QuizSearch {
  subject?: SubjectId;
  topic?: string;
  surprise?: boolean;
}

export const Route = createFileRoute("/quiz")({
  validateSearch: (search: Record<string, unknown>): QuizSearch => {
    const subject = SUBJECTS.find((s) => s.id === search["subject"]);
    const topic = subject?.topics.find((t) => t.id === search["topic"]);
    return {
      ...(subject ? { subject: subject.id } : {}),
      ...(topic ? { topic: topic.id } : {}),
      ...(search["surprise"] === true || search["surprise"] === "true" ? { surprise: true } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Quiz Studio — ReviseWise" },
      {
        name: "description",
        content:
          "Build an AI quiz for your exam, with step-by-step solutions and JEE/NEET-style negative marking.",
      },
      { property: "og:title", content: "Quiz Studio — ReviseWise" },
      {
        property: "og:description",
        content: "Practise with quick quizzes and learn from every explanation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuizStudio,
});

type Phase = "setup" | "taking" | "results";

const BAND_COPY = {
  strong: {
    label: "Strong",
    variant: "success" as const,
    text: "Great work — you've got a solid grip on this topic.",
  },
  developing: {
    label: "Developing",
    variant: "warning" as const,
    text: "Good progress. Review the explanations below and try again.",
  },
  "needs-revision": {
    label: "Needs revision",
    variant: "danger" as const,
    text: "This topic needs more revision. Add it to your planner.",
  },
};

function QuizStudio() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/quiz" });
  const [choice, setChoice] = useStudyChoice({ subject: search.subject, topic: search.topic });
  const [isSurprise, setIsSurprise] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState<number>(5);
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});

  /** Questions whose answer the student has checked: locked, with the solution shown. */
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // JEE and NEET use +4 / −1 (negative marking on by default, can be switched off);
  // every other exam uses +1 / 0.
  const examMarking = markingFor(choice.exam);
  const examHasNegative = hasNegativeMarking(choice.exam);
  const [negativeMarking, setNegativeMarking] = useState(examHasNegative);
  useEffect(() => setNegativeMarking(hasNegativeMarking(choice.exam)), [choice.exam]);
  /** Scheme used by the quiz on screen, fixed when it was generated. */
  const [quizMarking, setQuizMarking] = useState<Marking>(examMarking);

  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const marked = markQuiz(questions, answers, quizMarking);
  const band = scoreBand(marked.percent);

  const [loading, setLoading] = useState<"ai" | "surprise" | null>(null);

  const runAi = async (kind: "ai" | "surprise", topics: QuizTopicInput[], n: number) => {
    setLoading(kind);
    try {
      const res = await generateQuizFn({
        data: { topics, count: n, exam: choice.exam, level: choice.level },
      });
      if (!res.ok) {
        toast.error("Couldn't generate a quiz right now. Please try again.");
        return;
      }
      setIsSurprise(kind === "surprise");
      setQuizMarking(quizMarkingFor(choice.exam, negativeMarking));
      setQuestions(res.questions);
      setAnswers({});
      setChecked({});
      setPhase("taking");
      window.scrollTo({ top: 0 });
    } catch {
      toast.error("Couldn't generate a quiz right now. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const generate = () => {
    const r = resolveStudy(choice, { topicRequired: true });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const { subjectId, subjectName, topicId, topicName } = r.value;
    void runAi(
      "ai",
      [
        {
          ...(subjectId ? { subjectId } : {}),
          subjectName,
          topicId: topicId ?? topicName ?? subjectName,
          topicName: topicName ?? subjectName,
          difficulty,
        },
      ],
      count,
    );
  };

  const surprise = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attempts = quizAttemptsStore.get();
    const seen = new Set<string>();
    const topics: QuizTopicInput[] = [];
    const named = (subjectId: SubjectId, topicId: string) => ({
      subjectId,
      subjectName: getSubject(subjectId).name,
      topicId,
      topicName: getTopicName(subjectId, topicId),
    });
    for (const t of [...revisionDue(attempts, today), ...weakAreas(attempts)]) {
      const k = `${t.subjectId}:${t.topicId}`;
      if (seen.has(k) || topics.length >= SURPRISE_QUESTION_COUNT) continue;
      seen.add(k);
      topics.push({ ...named(t.subjectId, t.topicId), difficulty: "easy" });
    }
    // Fill with random stretch topics when little is due.
    const all = SUBJECTS.flatMap((s) => s.topics.map((t) => ({ subjectId: s.id, topicId: t.id })))
      .filter((t) => !seen.has(`${t.subjectId}:${t.topicId}`))
      .sort(() => Math.random() - 0.5);
    while (topics.length < SURPRISE_QUESTION_COUNT && all.length) {
      const t = all.pop()!;
      topics.push({ ...named(t.subjectId, t.topicId), difficulty: "hard" });
    }
    void runAi("surprise", topics, SURPRISE_QUESTION_COUNT);
  };

  // "Surprise me" from the dashboard starts straight away.
  const handledSearch = useRef(false);
  useEffect(() => {
    if (handledSearch.current) return;
    handledSearch.current = true;
    if (search.surprise) {
      surprise();
      void navigate({ search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    const exam = getExam(choice.exam).label;
    // Typed subjects are saved separately so built-in subject stats and revision stay accurate.
    const builtIn = questions.filter((q) => !q.subjectLabel);
    if (builtIn.length) {
      recordQuiz(builtIn, answers, {
        difficulty: isSurprise ? "mixed" : difficulty,
        source: isSurprise ? "surprise" : "studio",
        marking: quizMarking,
        exam,
      });
    }
    recordCustomQuiz(questions, answers, {
      difficulty,
      exam,
      level: choice.level,
      marking: quizMarking,
    });
    const marks = markQuiz(questions, answers, quizMarking);
    toast.success(`Quiz saved to My Progress — ${marks.marks}/${marks.maxMarks} marks`);
    setPhase("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <PageHeader
        title="Quiz Studio"
        description="Pick your exam, class, subject and topic — or type your own — and test yourself."
        actions={
          phase !== "setup" && (
            <Button variant="outline" size="sm" onClick={() => setPhase("setup")}>
              <RotateCcw /> New quiz
            </Button>
          )
        }
      />

      {phase === "setup" && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Set up your quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <StudyContextFields choice={choice} onChange={setChoice} />
            <Field label="Difficulty">
              <Segmented
                options={DIFFICULTIES.map((d) => ({
                  value: d,
                  label: d.charAt(0).toUpperCase() + d.slice(1),
                }))}
                value={difficulty}
                onChange={(v) => setDifficulty(v as Difficulty)}
                ariaLabel="Difficulty"
              />
            </Field>
            <Field label="Number of questions">
              <Segmented
                options={QUESTION_COUNTS.map((c) => ({
                  value: String(c),
                  label: `${c} questions`,
                }))}
                value={String(count)}
                onChange={(v) => setCount(Number(v))}
                ariaLabel="Number of questions"
              />
            </Field>
            {examHasNegative ? (
              <div className="flex items-start justify-between gap-4 rounded-xl border bg-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Negative marking</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {getExam(choice.exam).label} style: {signed(examMarking.correct)} for a correct
                    answer, {signed(examMarking.wrong)} for a wrong one, 0 if you skip. On by default
                    for this exam.
                  </p>
                </div>
                <Switch
                  checked={negativeMarking}
                  onCheckedChange={setNegativeMarking}
                  aria-label="Negative marking"
                />
              </div>
            ) : (
              <div className="rounded-xl border bg-surface px-4 py-3">
                <p className="text-sm font-medium">Marking</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {getExam(choice.exam).label} style: {signed(examMarking.correct)} for a correct
                  answer, no marks taken off for a wrong one.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="hero" size="lg" onClick={generate} disabled={loading !== null}>
                {loading === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate AI quiz
              </Button>
              <Button variant="soft" size="lg" onClick={surprise} disabled={loading !== null}>
                {loading === "surprise" ? <Loader2 className="animate-spin" /> : <Dices />} Surprise me
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Surprise me asks AI for a {SURPRISE_QUESTION_COUNT}-question mix from topics that are due
              for revision or need more practice, plus a few stretch questions.
            </p>
          </CardContent>
        </Card>
      )}

      {phase === "results" && (
        <Card className="mb-6 bg-gradient-soft">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex min-w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-background/50 px-3 py-3">
              <span className="font-display text-3xl font-semibold">
                {marked.marks}
                <span className="text-lg text-muted-foreground">/{marked.maxMarks}</span>
              </span>
              <span className="text-xs text-muted-foreground">marks</span>
              <span className="mt-1 text-center text-[11px] leading-tight text-muted-foreground">
                {marked.correct} right · {marked.wrong} wrong · {marked.unanswered} skipped
              </span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={BAND_COPY[band].variant}>
                  {BAND_COPY[band].label}
                </Badge>
                {isSurprise ? (
                  <span className="text-sm text-muted-foreground">
                    Surprise mix · {new Set(questions.map((q) => q.topicId)).size} topics
                  </span>
                ) : (
                  questions[0] && (
                    <>
                      <QuestionSubject q={questions[0]} />
                      <span className="text-sm text-muted-foreground">
                        {getTopicName(questions[0].subjectId, questions[0].topicId)} · {difficulty} ·{" "}
                        {getExam(choice.exam).label} {choice.level}
                      </span>
                    </>
                  )
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {BAND_COPY[band].text}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marking: {signed(quizMarking.correct)} correct, {signed(quizMarking.wrong)} wrong, 0
                skipped.
              </p>
            </div>
            <Button variant="hero" onClick={isSurprise ? surprise : generate}>
              {isSurprise ? <Dices /> : <RotateCcw />} {isSurprise ? "Another surprise" : "Retake"}
            </Button>
          </CardContent>
        </Card>
      )}

      {phase !== "setup" && (
        <div className="max-w-3xl space-y-4">
          {questions.map((q, qi) => (
            <Card key={q.id}>
              <CardContent className="p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Question {qi + 1} of {questions.length}
                  </span>
                  <Badge variant="soft" className="capitalize">
                    {q.difficulty}
                  </Badge>
                </div>
                {isSurprise && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <QuestionSubject q={q} />
                    <span className="text-xs text-muted-foreground">
                      {getTopicName(q.subjectId, q.topicId)}
                    </span>
                  </div>
                )}
                <p className="font-medium">{q.prompt}</p>
                <div
                  className="mt-4 grid gap-2"
                  role="radiogroup"
                  aria-label={`Question ${qi + 1}`}
                >
                  {q.options.map((opt, oi) => {
                    const picked = answers[q.id] === oi;
                    const showResult = phase === "results" || checked[q.id] === true;
                    const isAnswer = oi === q.answerIndex;
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={picked}
                        disabled={showResult}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                          !showResult &&
                            (picked
                              ? "border-primary bg-primary/15"
                              : "hover:border-primary/40 hover:bg-card-elevated"),
                          showResult && isAnswer && "border-success/60 bg-success/10",
                          showResult &&
                            picked &&
                            !isAnswer &&
                            "border-destructive/60 bg-destructive/10",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                            picked &&
                              !showResult &&
                              "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {showResult && isAnswer && <CheckCircle2 className="size-4 text-success" />}
                        {showResult && picked && !isAnswer && (
                          <XCircle className="size-4 text-destructive" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {phase === "taking" && !checked[q.id] && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {answers[q.id] !== undefined && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setAnswers((a) => {
                            const next = { ...a };
                            delete next[q.id];
                            return next;
                          })
                        }
                      >
                        Clear answer
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAnswers((a) => {
                          const next = { ...a };
                          delete next[q.id];
                          return next;
                        });
                        setChecked((c) => ({ ...c, [q.id]: true }));
                      }}
                    >
                      <SkipForward /> Skip (0 marks)
                    </Button>
                    <Button
                      variant="soft"
                      size="sm"
                      disabled={answers[q.id] === undefined}
                      onClick={() => setChecked((c) => ({ ...c, [q.id]: true }))}
                    >
                      <CheckCircle2 /> Check answer
                    </Button>
                  </div>
                )}
                {(phase === "results" || checked[q.id]) && (
                  <Solution q={q} answer={answers[q.id]} marking={quizMarking} />
                )}
              </CardContent>
            </Card>
          ))}

          {phase === "taking" && (
            <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 pl-5 shadow-card backdrop-blur">
              <span className="text-sm text-muted-foreground">
                {answeredCount}/{questions.length} answered · {questions.length - answeredCount} skipped
                (0 marks)
                <span className="block text-xs">
                  Marking: {signed(quizMarking.correct)} right, {signed(quizMarking.wrong)} wrong
                </span>
              </span>
              <Button variant="hero" onClick={submit}>
                Submit answers
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Step-by-step worked solution shown once a question is checked or the quiz is submitted. */
function Solution({
  q,
  answer,
  marking,
}: {
  q: QuizQuestion;
  answer: number | undefined;
  marking: Marking;
}) {
  const steps = q.steps?.length ? q.steps : q.explanation ? [q.explanation] : [];
  const verdict =
    answer === undefined ? "Skipped" : answer === q.answerIndex ? "Correct" : "Not quite";
  return (
    <div className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">
          <span
            className={cn(
              "mr-2",
              answer === undefined
                ? "text-warning"
                : answer === q.answerIndex
                  ? "text-success"
                  : "text-destructive",
            )}
          >
            {verdict} ·
          </span>
          Step-by-step solution
        </p>
        <MarksChip value={questionMarks(q, answer, marking)} />
      </div>
      {steps.length > 0 && (
        <ol className="mt-2.5 space-y-2">
          {steps.map((step, si) => (
            <li key={si} className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary-glow">
                {si + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2.5">
        <span className="font-medium text-success">
          Answer: {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}
        </span>
        {q.explanation && q.steps?.length ? (
          <span className="text-muted-foreground"> — {q.explanation}</span>
        ) : null}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Link
          to="/companion"
          search={{ prompt: q.prompt, mode: "explain", ...subjectSearch(q) }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-primary-glow transition-colors hover:bg-primary/15"
        >
          <MessageSquareText className="size-3.5" /> Explain this
        </Link>
        <Link
          to="/companion"
          search={{ prompt: q.prompt, mode: "hint", ...subjectSearch(q) }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-primary-glow transition-colors hover:bg-primary/15"
        >
          <Lightbulb className="size-3.5" /> Give me a hint
        </Link>
      </div>
    </div>
  );
}

interface QuizTopicInput {
  subjectId?: SubjectId;
  subjectName: string;
  topicId: string;
  topicName: string;
  difficulty: Difficulty;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function MarksChip({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        value > 0 && "bg-success/15 text-success",
        value < 0 && "bg-destructive/15 text-destructive",
        value === 0 && "bg-muted text-muted-foreground",
      )}
    >
      {signed(value)} marks
    </span>
  );
}

const subjectSearch = (q: QuizQuestion) =>
  q.subjectLabel ? { customSubject: q.subjectLabel } : { subject: q.subjectId };

function QuestionSubject({ q }: { q: QuizQuestion }) {
  if (!q.subjectLabel) return <SubjectTag id={q.subjectId} />;
  return (
    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-glow">
      {q.subjectLabel}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-xl bg-surface p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            o.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
