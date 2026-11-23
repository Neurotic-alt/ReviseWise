import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpenText,
  Bot,
  Info,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DemoBadge, PageHeader, SubjectTag } from "@/components/app/common";
import { PracticeCard } from "@/components/app/PracticeCard";
import { StudyContextFields, useStudyChoice } from "@/components/app/StudyContextFields";
import { RichText } from "@/components/app/RichText";
import {
  COMPANION_MODES,
  QUICK_ACTIONS,
  STARTER_PROMPTS,
  demoCompanionReply,
  isCompanionMode,
  type ChatMessage,
  type CompanionMode,
} from "@/lib/companion";
import { logCompanionQuestion } from "@/lib/data/actions";
import { chatStore, settingsStore } from "@/lib/data/stores";
import { SUBJECTS, getSubject } from "@/lib/data/subjects";
import { MAX_CUSTOM_CHARS, resolveStudy } from "@/lib/study-context";
import type { SubjectId } from "@/lib/data/types";
import { newId } from "@/lib/planner";
import { useStore } from "@/lib/store";
import { askTutorFn } from "@/lib/tutor.functions";
import { MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS } from "@/lib/tutor-prompt";
import { cn } from "@/lib/utils";

interface CompanionSearch {
  prompt?: string;
  mode?: CompanionMode;
  subject?: SubjectId;
  customSubject?: string;
}

/** Subject and optional topic a message is about. */
interface SendTarget {
  subjectId: SubjectId | null;
  subjectName: string;
  topicName: string | null;
}

const isSubjectId = (v: unknown): v is SubjectId => SUBJECTS.some((s) => s.id === v);

export const Route = createFileRoute("/companion")({
  staticData: { sitemap: true },
  validateSearch: (search: Record<string, unknown>): CompanionSearch => {
    const prompt = search["prompt"];
    const mode = search["mode"];
    const subject = search["subject"];
    const customSubject = search["customSubject"];
    return {
      ...(typeof prompt === "string" && prompt.trim() ? { prompt: prompt.slice(0, 300) } : {}),
      ...(isCompanionMode(mode) ? { mode } : {}),
      ...(isSubjectId(subject) ? { subject } : {}),
      ...(typeof customSubject === "string" && customSubject.trim()
        ? { customSubject: customSubject.slice(0, MAX_CUSTOM_CHARS) }
        : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "AI Study Companion — ReviseWise" },
      {
        name: "description",
        content:
          "Ask an AI tutor for explanations, hints, summaries or practice questions in any subject.",
      },
      { property: "og:title", content: "AI Study Companion — ReviseWise" },
      {
        property: "og:description",
        content: "An AI study companion for explanations, hints, summaries and practice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompanionPage,
});

const MODE_ICONS: Record<CompanionMode, typeof Bot> = {
  explain: MessageSquareText,
  hint: Lightbulb,
  practice: ListChecks,
  summarise: BookOpenText,
};

function CompanionPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/companion" });
  const askTutor = useServerFn(askTutorFn);
  const [choice, setChoice] = useStudyChoice({
    subject: search.subject,
    customSubject: search.customSubject,
    topicOptional: true,
  });
  const [mode, setMode] = useState<CompanionMode>(search.mode ?? "explain");
  const [input, setInput] = useState("");
  const messages = useStore(chatStore) ?? [];
  const setMessages = (update: (prev: ChatMessage[]) => ChatMessage[]) => chatStore.set(update);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const handledSearch = useRef(false);

  const currentTarget = (): SendTarget | null => {
    const r = resolveStudy(choice, { topicRequired: false });
    if (!r.ok) {
      toast.error(r.error);
      return null;
    }
    return { subjectId: r.value.subjectId, subjectName: r.value.subjectName, topicName: r.value.topicName };
  };

  const send = async (text: string, sendMode: CompanionMode = mode, given?: SendTarget) => {
    const trimmed = text.trim();
    if (pendingRef.current || (!trimmed && sendMode !== "practice")) return;
    const target = given ?? currentTarget();
    if (!target) return;
    const sendSubject = target.subjectId;
    const labels = {
      ...(sendSubject ? { subjectId: sendSubject } : { subjectLabel: target.subjectName }),
      ...(target.topicName ? { topicLabel: target.topicName } : {}),
    };
    const studentText = (trimmed || "Give me a practice question").slice(0, MAX_QUESTION_CHARS);
    const previous = chatStore.get();
    const turn = previous.filter((m) => m.role === "companion").length;
    setMessages((prev) => [
      ...prev,
      { id: newId("m"), role: "student", text: studentText, mode: sendMode, ...labels },
    ]);
    logCompanionQuestion();
    setInput("");
    pendingRef.current = true;
    setPending(true);

    const s = settingsStore.get();
    const sample = (): Omit<ChatMessage, "id"> => ({
      ...demoCompanionReply(studentText, sendSubject ?? "maths", sendMode, turn),
      ...labels,
      aiUnavailable: true,
    });
    let reply: Omit<ChatMessage, "id">;
    try {
      const result = await askTutor({
        data: {
          question: studentText,
          ...(sendSubject ? { subjectId: sendSubject } : {}),
          subjectName: target.subjectName,
          ...(target.topicName ? { topicName: target.topicName } : {}),
          exam: choice.exam,
          mode: sendMode,
          profile: {
            yearGroup: choice.level,
            curriculum: s.curriculum.slice(0, 60),
            country: s.country,
            language: s.language,
            explanationStyle: s.explanationStyle,
          },
          history: previous.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
            role: m.role,
            text: (m.practice ? `${m.text}\n${m.practice.prompt}` : m.text).slice(0, 4000),
          })),
        },
      });
      reply = result.ok
        ? {
            role: "companion",
            text: result.text,
            mode: sendMode,
            ...labels,
            question: studentText,
            ...(result.practice ? { practice: result.practice } : {}),
          }
        : sample();
    } catch {
      reply = sample();
    }
    setMessages((prev) => [...prev, { id: newId("m"), ...reply }]);
    pendingRef.current = false;
    setPending(false);
  };

  // Respect the "Keep chat history" privacy setting.
  useEffect(() => {
    const clearIfNotKept = () => {
      if (!settingsStore.get().saveChatHistory) chatStore.set(() => []);
    };
    clearIfNotKept();
    return clearIfNotKept;
  }, []);

  // Arriving from a quick action elsewhere (e.g. "Explain this" on a quiz question) asks it once.
  useEffect(() => {
    if (handledSearch.current) return;
    handledSearch.current = true;
    if (search.prompt) {
      void send(search.prompt, search.mode ?? "explain");
      void navigate({ search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only follow the conversation once it has started, so the page opens at the top.
  useEffect(() => {
    if (messages.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const lastQuestion = [...messages].reverse().find((m) => m.role === "student")?.text ?? "";
  const quickTarget = input.trim() || lastQuestion;

  return (
    <>
      <PageHeader
        title="AI Study Companion"
        description="Choose a subject and a mode, then ask your question."
        actions={
          messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => chatStore.set(() => [])}>
              <RotateCcw /> New chat
            </Button>
          )
        }
      />

      <div
        role="note"
        className="mb-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-primary-glow" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Powered by Gemini AI.</span> Answers can
          contain mistakes — check important facts against your notes or ask your teacher.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="surface-card h-fit space-y-5 p-4">
          <StudyContextFields choice={choice} onChange={setChoice} topicOptional layout="stack" />
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mode
            </p>
            <div
              className="grid grid-cols-2 gap-2 lg:grid-cols-1"
              role="radiogroup"
              aria-label="Mode"
            >
              {COMPANION_MODES.map((m) => {
                const Icon = MODE_ICONS[m.id];
                const active = m.id === mode;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active ? "border-primary/60 bg-primary/15" : "hover:bg-card-elevated",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon
                        className={cn(
                          "size-4",
                          active ? "text-primary-glow" : "text-muted-foreground",
                        )}
                      />
                      {m.label}
                    </span>
                    <span className="hidden text-xs text-muted-foreground lg:block">
                      {m.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="surface-card flex min-h-[60vh] flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
                  <Bot className="size-6 text-primary-foreground" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">What are you studying today?</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Ask anything from your lessons, or try one of these.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {(choice.subject in STARTER_PROMPTS
                    ? STARTER_PROMPTS[choice.subject as SubjectId]
                    : [
                        `Explain the basics of ${choice.customSubject.trim() || "this subject"}`,
                        "What are the most important topics to revise?",
                      ]
                  ).map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={pending}
                      onClick={() => void send(p)}
                      className="rounded-full border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <Message
                  key={m.id}
                  message={m}
                  disabled={pending}
                  onAction={(actionMode) => {
                    if (!m.question) return;
                    const subjectName = m.subjectLabel ?? (m.subjectId ? getSubject(m.subjectId).name : "");
                    void send(
                      m.question,
                      actionMode,
                      subjectName
                        ? { subjectId: m.subjectId ?? null, subjectName, topicName: m.topicLabel ?? null }
                        : undefined,
                    );
                  }}
                />
              ))
            )}
            {pending && (
              <div className="flex items-center gap-2 pl-11 text-xs text-muted-foreground" aria-label="Thinking">
                <span className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </span>
                Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="space-y-2.5 border-t p-3 sm:p-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick AI actions">
              {QUICK_ACTIONS.map((a) => {
                const Icon = MODE_ICONS[a.mode];
                return (
                  <button
                    key={a.mode}
                    type="button"
                    disabled={pending || (!quickTarget && a.mode !== "practice")}
                    onClick={() => void send(quickTarget, a.mode)}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon className="size-3.5" />
                    {a.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                maxLength={MAX_QUESTION_CHARS}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder={
                  mode === "practice"
                    ? "Name a topic to be tested on, or just press send…"
                    : "Type or paste what you're studying…"
                }
                aria-label="Your question"
                className="max-h-40 min-h-11 resize-none rounded-xl bg-surface"
              />
              <Button
                type="submit"
                variant="hero"
                size="icon"
                className="size-11 shrink-0"
                disabled={pending}
                aria-label="Send"
              >
                <Send />
              </Button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

function Message({
  message,
  onAction,
  disabled,
}: {
  message: ChatMessage;
  onAction: (mode: CompanionMode) => void;
  disabled: boolean;
}) {
  if (message.role === "student") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-gradient-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    );
  }
  const modeLabel = COMPANION_MODES.find((m) => m.id === message.mode)?.label;
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
        <Bot className="size-4 text-primary-glow" />
      </span>
      <div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-md bg-surface px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {message.isDemo ? (
            <DemoBadge label="Sample response" />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-glow">
              <Sparkles className="size-3" /> Gemini
            </span>
          )}
          {message.subjectLabel ? (
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-glow">
              {message.subjectLabel}
            </span>
          ) : (
            message.subjectId && <SubjectTag id={message.subjectId} />
          )}
          {message.topicLabel && (
            <span className="text-xs text-muted-foreground">{message.topicLabel}</span>
          )}
          {modeLabel && <span className="text-xs text-muted-foreground">{modeLabel} mode</span>}
        </div>
        {message.aiUnavailable && (
          <p className="mb-2 text-xs text-warning">
            The AI tutor couldn't be reached just now, so this is a pre-written sample. Please try
            again in a moment.
          </p>
        )}
        <RichText text={message.text} />
        {message.practice && <PracticeCard question={message.practice} />}
        {message.question && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
            {QUICK_ACTIONS.filter((a) => a.mode !== message.mode).map((a) => (
              <button
                key={a.mode}
                type="button"
                disabled={disabled}
                onClick={() => onAction(a.mode)}
                className="rounded-full px-2.5 py-1 text-xs text-primary-glow transition-colors hover:bg-primary/15 disabled:opacity-40"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
