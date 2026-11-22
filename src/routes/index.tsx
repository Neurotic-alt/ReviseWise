import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  Bell,
  Bot,
  CalendarClock,
  Flame,
  GraduationCap,
  Target,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  DemoBadge,
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatCard,
  SubjectTag,
} from "@/components/app/common";
import {
  DailyMissionCard,
  QuickActionsCard,
  RevisionDueCard,
  SurpriseMeCard,
  WeakAreasCard,
  WeeklySummaryCard,
} from "@/components/app/learning";
import { DEMO_SUBJECT_PROGRESS } from "@/lib/data/demo-data";
import { setTaskDone } from "@/lib/data/actions";
import { examsStore, quizAttemptsStore, settingsStore, tasksStore } from "@/lib/data/stores";
import { SUBJECTS, getTopicName, subjectStyle } from "@/lib/data/subjects";
import { completionPercent, daysUntil, tasksOn, toISODate, upcomingExams } from "@/lib/planner";
import { useStore, useToday } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ReviseWise" },
      {
        name: "description",
        content:
          "Your ReviseWise dashboard: today's study tasks, upcoming revision, quiz results and progress.",
      },
      { property: "og:title", content: "Dashboard — ReviseWise" },
      {
        property: "og:description",
        content:
          "See today's study tasks, upcoming revision sessions and learning progress at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const settings = useStore(settingsStore);
  const tasks = useStore(tasksStore);
  const exams = useStore(examsStore);
  const attempts = useStore(quizAttemptsStore);
  const today = useToday();

  const todayKey = today ? toISODate(today) : "";
  const todaysTasks = tasks ? tasksOn(tasks, todayKey) : [];
  const nextExam = today && exams ? upcomingExams(exams, today)[0] : undefined;
  const avgScore =
    attempts && attempts.length
      ? Math.round((attempts.reduce((s, a) => s + a.correct / a.total, 0) / attempts.length) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title={settings ? `Welcome back, ${settings.name}` : "Welcome back"}
        description={
          today
            ? `${format(today, "EEEE d MMMM")} · Small, steady sessions beat last-minute cramming.`
            : "Small, steady sessions beat last-minute cramming."
        }
        actions={
          <Button variant="hero" asChild>
            <Link to="/companion">
              <Bot /> Ask the AI Companion
            </Link>
          </Button>
        }
      />

      {settings?.reminders && todaysTasks.some((t) => !t.done) && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <Bell className="size-4 shrink-0 text-primary-glow" />
          <span>
            Reminder: you have {todaysTasks.filter((t) => !t.done).length} study{" "}
            {todaysTasks.filter((t) => !t.done).length === 1 ? "task" : "tasks"} left today.
          </span>
        </div>
      )}

      <div className="mb-6 grid items-start gap-4 lg:grid-cols-3">
        <DailyMissionCard className="lg:col-span-2" />
        <QuickActionsCard />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Study streak" value="6 days" hint={<DemoBadge />} icon={<Flame />} />
        <StatCard
          label="Today's tasks"
          value={tasks ? `${todaysTasks.filter((t) => t.done).length}/${todaysTasks.length}` : "–"}
          hint="completed"
          icon={<Target />}
        />
        <StatCard
          label="Average quiz score"
          value={`${avgScore}%`}
          hint="across all quizzes"
          icon={<Trophy />}
        />
        <StatCard
          label="Next exam"
          value={nextExam && today ? `${daysUntil(nextExam.date, today)} days` : "–"}
          hint={nextExam?.title ?? "No exams added"}
          icon={<CalendarClock />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Today's study tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/planner">
                Planner <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!tasks ? (
              <LoadingBlock />
            ) : todaysTasks.length === 0 ? (
              <EmptyState
                title="Nothing scheduled today"
                description="Add a task in the Revision Planner."
              />
            ) : (
              <>
                <Progress
                  value={completionPercent(todaysTasks)}
                  className="mb-4"
                  aria-label="Today's completion"
                />
                <ul className="space-y-2">
                  {todaysTasks.map((task) => (
                    <li key={task.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface px-3.5 py-3 transition-colors hover:bg-card-elevated">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={(v) => setTaskDone(task.id, v === true)}
                        />
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            task.done && "text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {task.durationMin} min
                        </span>
                        <SubjectTag id={task.subjectId} />
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <RevisionDueCard />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <WeakAreasCard className="lg:col-span-2" limit={3} />
        <SurpriseMeCard />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Subjects</h2>
          <DemoBadge label="Demo mastery" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map((s) => {
            const style = subjectStyle(s.id);
            const value = DEMO_SUBJECT_PROGRESS[s.id];
            return (
              <Link
                key={s.id}
                to="/quiz"
                className="surface-card group block p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn("flex size-9 items-center justify-center rounded-lg", style.soft)}
                  >
                    <GraduationCap className="size-4" />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.topics.map((t) => t.name).join(" · ")}
                    </p>
                  </div>
                  <span className="font-display text-sm font-semibold">{value}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", style.bar)}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming revision</CardTitle>
          </CardHeader>
          <CardContent>
            {!tasks || !today ? (
              <LoadingBlock />
            ) : (
              <ul className="space-y-3">
                {tasks
                  .filter((t) => t.date > todayKey && !t.done)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .slice(0, 4)
                  .map((t) => (
                    <li
                      key={t.id}
                      className={cn("border-l-2 pl-3", subjectStyle(t.subjectId).border)}
                    >
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(t.date), "EEE d MMM")} · {t.durationMin} min
                      </p>
                    </li>
                  ))}
                {tasks.filter((t) => t.date > todayKey && !t.done).length === 0 && (
                  <EmptyState title="No upcoming sessions" />
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent quizzes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/quiz">
                New quiz <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!attempts ? (
              <LoadingBlock />
            ) : (
              <ul className="space-y-3">
                {[...attempts]
                  .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
                  .slice(0, 4)
                  .map((a) => {
                    const pct = Math.round((a.correct / a.total) * 100);
                    return (
                      <li key={a.id}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate">{getTopicName(a.subjectId, a.topicId)}</span>
                          <span className="font-medium">{pct}%</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {a.isDemo && (
                            <span className="text-[10px] uppercase tracking-wide text-warning">
                              demo
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </CardContent>
        </Card>

        <WeeklySummaryCard compact />
      </div>
    </>
  );
}
