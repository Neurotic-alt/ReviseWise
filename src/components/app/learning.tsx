import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpenText,
  Bot,
  CalendarClock,
  Check,
  Dices,
  Lightbulb,
  ListChecks,
  Lock,
  MessageSquareText,
  Minus,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QUICK_ACTIONS, type CompanionMode } from "@/lib/companion";
import {
  activityStore,
  examsStore,
  missionDaysStore,
  quizAttemptsStore,
  tasksStore,
} from "@/lib/data/stores";
import { getTopicName, subjectStyle } from "@/lib/data/subjects";
import {
  achievements,
  dailyMissions,
  revisionDue,
  weakAreas,
  weeklySummary,
  type Mission,
  type WeekStats,
} from "@/lib/learning";
import { toISODate } from "@/lib/planner";
import { useStore, useToday } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DemoBadge, EmptyState, LoadingBlock, SubjectTag } from "./common";

/** All the records the learning features read, or null until the browser has loaded them. */
export function useLearningData() {
  const tasks = useStore(tasksStore);
  const attempts = useStore(quizAttemptsStore);
  const exams = useStore(examsStore);
  const activity = useStore(activityStore);
  const missionDays = useStore(missionDaysStore);
  const today = useToday();
  if (!tasks || !attempts || !exams || !activity || !missionDays || !today) return null;
  return { tasks, attempts, exams, activity, missionDays, today };
}

const DemoTag = () => (
  <span className="text-[10px] font-medium uppercase tracking-wide text-warning">demo</span>
);

// ---------------------------------------------------------------------------

const MISSION_ICONS: Record<Mission["id"], typeof Target> = {
  "study-task": CalendarClock,
  "practise-topic": ListChecks,
  "ask-companion": Bot,
};

function MissionLink({ mission, children }: { mission: Mission; children: ReactNode }) {
  const cls =
    "group flex h-full items-start gap-3 rounded-xl border bg-background/40 p-3.5 transition-colors hover:border-primary/50";
  if (mission.id === "practise-topic" && mission.topic) {
    return (
      <Link
        to="/quiz"
        search={{ subject: mission.topic.subjectId, topic: mission.topic.topicId }}
        className={cls}
      >
        {children}
      </Link>
    );
  }
  if (mission.id === "ask-companion") {
    return (
      <Link to="/companion" search={{}} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/planner" className={cls}>
      {children}
    </Link>
  );
}

export function DailyMissionCard({ className }: { className?: string }) {
  const data = useLearningData();
  const missions = data ? dailyMissions(data.today, data) : [];
  const doneCount = missions.filter((m) => m.done).length;
  const todayKey = data ? toISODate(data.today) : "";
  const allDone = missions.length > 0 && doneCount === missions.length;

  // Remember days where every mission was finished (for achievements).
  useEffect(() => {
    if (allDone && todayKey && !missionDaysStore.get().includes(todayKey)) {
      missionDaysStore.set((prev) => [...prev, todayKey]);
    }
  }, [allDone, todayKey]);

  return (
    <Card className={cn("bg-gradient-soft", className)}>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="size-4 text-primary-glow" /> Daily Mission
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {allDone ? "All done for today — brilliant work." : "Three small goals for today."}
          </p>
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-label={`${doneCount} of 3 missions complete`}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full",
                i < doneCount ? "bg-gradient-primary" : "bg-muted",
              )}
            />
          ))}
          <span className="ml-1.5 font-display text-sm font-semibold">{doneCount}/3</span>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <LoadingBlock rows={1} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-3">
            {missions.map((m) => {
              const Icon = MISSION_ICONS[m.id];
              return (
                <li key={m.id}>
                  <MissionLink mission={m}>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        m.done ? "bg-success/20 text-success" : "bg-primary/15 text-primary-glow",
                      )}
                    >
                      {m.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          m.done && "text-muted-foreground line-through",
                        )}
                      >
                        {m.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {m.done ? "Completed" : m.detail}
                      </span>
                    </span>
                  </MissionLink>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function WeakAreasCard({ className, limit = 4 }: { className?: string; limit?: number }) {
  const data = useLearningData();
  const list = data ? weakAreas(data.attempts).slice(0, limit) : [];
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-warning" /> Your weak areas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Topics where your latest score was under 60%.
        </p>
      </CardHeader>
      <CardContent>
        {!data ? (
          <LoadingBlock />
        ) : list.length === 0 ? (
          <EmptyState
            title="No weak areas right now"
            description="Keep practising to stay on top."
          />
        ) : (
          <ul className="space-y-2">
            {list.map((w) => (
              <li key={`${w.subjectId}:${w.topicId}`} className="rounded-xl bg-surface p-3.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {getTopicName(w.subjectId, w.topicId)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <SubjectTag id={w.subjectId} />
                      <span className="text-xs text-destructive">{w.percent}%</span>
                      {w.isDemo && <DemoTag />}
                    </div>
                  </div>
                  <Button variant="soft" size="sm" asChild>
                    <Link to="/quiz" search={{ subject: w.subjectId, topic: w.topicId }}>
                      Practise
                    </Link>
                  </Button>
                </div>
                {w.missedConcepts.length > 0 && (
                  <div className="mt-3 border-t pt-2.5">
                    <p className="text-xs text-muted-foreground">Concepts to practise</p>
                    <ul className="mt-1 space-y-1">
                      {w.missedConcepts.slice(0, 3).map((c) => (
                        <li key={c} className="text-xs">
                          · {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function RevisionDueCard({ className, limit = 4 }: { className?: string; limit?: number }) {
  const data = useLearningData();
  const due = data ? revisionDue(data.attempts, data.today) : [];
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-info" /> Revision due
        </CardTitle>
        {data && <span className="text-xs text-muted-foreground">{due.length} topics</span>}
      </CardHeader>
      <CardContent>
        {!data ? (
          <LoadingBlock />
        ) : due.length === 0 ? (
          <EmptyState
            title="Nothing due today"
            description="Topics come back for review a few days after each quiz."
          />
        ) : (
          <ul className="space-y-2">
            {due.slice(0, limit).map((d) => (
              <li key={`${d.subjectId}:${d.topicId}`}>
                <Link
                  to="/quiz"
                  search={{ subject: d.subjectId, topic: d.topicId }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-l-2 bg-surface px-3 py-2.5 transition-colors hover:bg-card-elevated",
                    subjectStyle(d.subjectId).border,
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {getTopicName(d.subjectId, d.topicId)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last score {d.percent}% ·{" "}
                      {d.daysOverdue === 0 ? "due today" : `${d.daysOverdue}d overdue`}
                      {d.isDemo && (
                        <>
                          {" "}
                          · <DemoTag />
                        </>
                      )}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
            {due.length > limit && (
              <li className="pt-1 text-xs text-muted-foreground">+{due.length - limit} more</li>
            )}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Review after 1 day if you scored under 60%, 3 days under 80%, otherwise 7 days.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function SurpriseMeCard({ className }: { className?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <Dices className="size-5 text-primary-foreground" />
        </span>
        <CardTitle className="text-lg">Surprise me</CardTitle>
        <p className="text-sm text-muted-foreground">
          A 5-question mix built from your weak and due topics, plus a few stretch questions.
        </p>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button variant="hero" className="w-full" asChild>
          <Link to="/quiz" search={{ surprise: true }}>
            <Dices /> Start a surprise test
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

const QUICK_ICONS: Record<CompanionMode, typeof Bot> = {
  explain: MessageSquareText,
  hint: Lightbulb,
  practice: ListChecks,
  summarise: BookOpenText,
};

export function QuickActionsCard({ className }: { className?: string }) {
  const [text, setText] = useState("");
  const navigate = useNavigate();
  const go = (mode: CompanionMode) =>
    navigate({
      to: "/companion",
      search: { prompt: text.trim() || "Give me a practice question", mode },
    });

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="size-4 text-primary-glow" /> Quick AI actions
        </CardTitle>
        <p className="text-sm text-muted-foreground">Type a topic or paste a question.</p>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="e.g. photosynthesis"
          aria-label="Topic or question for quick actions"
          className="bg-background/40"
        />
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((a) => {
            const Icon = QUICK_ICONS[a.mode];
            return (
              <Button
                key={a.mode}
                type="button"
                variant="outline"
                size="sm"
                className="justify-start bg-background/30"
                disabled={!text.trim() && a.mode !== "practice"}
                onClick={() => go(a.mode)}
              >
                <Icon /> {a.label}
              </Button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Opens the AI Companion (sample responses for now).
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Delta({
  now,
  before,
  suffix = "",
}: {
  now: number | null;
  before: number | null;
  suffix?: string | undefined;
}) {
  if (now === null || before === null)
    return <span className="text-xs text-muted-foreground">no data last week</span>;
  const diff = now - before;
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" /> same as last week
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs",
        diff > 0 ? "text-success" : "text-muted-foreground",
      )}
    >
      {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {diff > 0 ? "+" : ""}
      {diff}
      {suffix} vs last week
    </span>
  );
}

const STAT_ROWS: {
  key: keyof WeekStats;
  label: string;
  format: (v: number | null) => string;
  suffix?: string;
}[] = [
  { key: "studyMinutes", label: "Study time", format: (v) => `${v ?? 0} min`, suffix: " min" },
  { key: "tasksDone", label: "Tasks done", format: (v) => `${v ?? 0}` },
  { key: "quizzes", label: "Quizzes", format: (v) => `${v ?? 0}` },
  {
    key: "averageScore",
    label: "Average score",
    format: (v) => (v === null ? "–" : `${v}%`),
    suffix: " pts",
  },
];

export function WeeklySummaryCard({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const data = useLearningData();
  const summary = data ? weeklySummary(data.tasks, data.attempts, data.today) : null;

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle>Weekly learning summary</CardTitle>
          {summary && (
            <p className="mt-1 text-xs text-muted-foreground">
              Since Monday {format(parseISO(summary.weekStart), "d MMM")}
            </p>
          )}
        </div>
        {summary?.includesDemo && <DemoBadge label="Includes demo" />}
      </CardHeader>
      <CardContent>
        {!summary ? (
          <LoadingBlock />
        ) : (
          <>
            <div
              className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}
            >
              {(compact ? STAT_ROWS.slice(0, 2) : STAT_ROWS).map((r) => (
                <div key={r.key} className="rounded-xl bg-surface p-3">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="mt-1 font-display text-xl font-semibold">
                    {r.format(summary.thisWeek[r.key])}
                  </p>
                  <Delta
                    now={summary.thisWeek[r.key]}
                    before={summary.lastWeek[r.key]}
                    suffix={r.suffix}
                  />
                </div>
              ))}
            </div>

            <div className={cn("mt-4 grid gap-4", !compact && "md:grid-cols-2")}>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What you studied
                </p>
                {summary.topicsPractised.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No quizzes yet this week.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {summary.topicsPractised.slice(0, compact ? 4 : 12).map((t) => (
                      <span
                        key={`${t.subjectId}:${t.topicId}`}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs",
                          subjectStyle(t.subjectId).soft,
                        )}
                      >
                        {getTopicName(t.subjectId, t.topicId)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!compact && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Where you improved
                  </p>
                  {summary.improved.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Retake a topic from an earlier week to see your improvement here.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {summary.improved.map((i) => (
                        <li
                          key={`${i.subjectId}:${i.topicId}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{getTopicName(i.subjectId, i.topicId)}</span>
                          <span className="text-success">
                            {i.from}% → {i.to}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {compact && (
              <Link
                to="/progress"
                className="mt-4 inline-block text-sm text-primary-glow hover:underline"
              >
                See full summary
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function AchievementsCard({ className }: { className?: string }) {
  const data = useLearningData();
  const list = data ? achievements(data) : [];
  const unlocked = list.filter((a) => a.unlocked).length;
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Award className="size-4 text-warning" /> Learning achievements
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal milestones — you're only ever compared with your past self.
          </p>
        </div>
        {data && (
          <span className="font-display text-sm font-semibold">
            {unlocked}/{list.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!data ? (
          <LoadingBlock />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "rounded-xl border p-3.5 transition-colors",
                  a.unlocked ? "border-warning/30 bg-gold/45" : "bg-surface",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      a.unlocked ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {a.unlocked ? <Award className="size-4" /> : <Lock className="size-3.5" />}
                  </span>
                  <span
                    className={cn("text-sm font-medium", !a.unlocked && "text-muted-foreground")}
                  >
                    {a.title}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{a.description}</p>
                {a.progress && !a.unlocked && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-primary"
                        style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {a.progress.current}/{a.progress.target}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Only your own activity counts — demo records never unlock achievements.
        </p>
      </CardContent>
    </Card>
  );
}
