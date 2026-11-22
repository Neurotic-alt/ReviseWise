import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO, subDays } from "date-fns";
import { AlertTriangle, BookOpenCheck, Clock, ListChecks, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DemoBadge,
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatCard,
  SubjectTag,
} from "@/components/app/common";
import {
  AchievementsCard,
  RevisionDueCard,
  SurpriseMeCard,
  WeakAreasCard,
  WeeklySummaryCard,
} from "@/components/app/learning";
import {
  DEMO_DAILY_MINUTES,
  DEMO_STUDY_SESSIONS,
  DEMO_SUBJECT_PROGRESS,
} from "@/lib/data/demo-data";
import { customQuizAttemptsStore, quizAttemptsStore } from "@/lib/data/stores";
import { SUBJECTS, getTopicName, subjectStyle } from "@/lib/data/subjects";
import { WEAK_THRESHOLD, weakAreas } from "@/lib/learning";
import { averageBySubject, customSubjectStats } from "@/lib/progress";
import { useStore, useToday } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "My Progress — ReviseWise" },
      {
        name: "description",
        content:
          "Track study activity, subject progress, quiz history and the topics that need revision.",
      },
      { property: "og:title", content: "My Progress — ReviseWise" },
      {
        property: "og:description",
        content:
          "Learning analytics: activity, subject progress, quiz history and revision priorities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressPage,
});

const chartConfig = {
  minutes: { label: "Minutes", color: "var(--primary)" },
} satisfies ChartConfig;

function ProgressPage() {
  const attempts = useStore(quizAttemptsStore);
  const customAttempts = useStore(customQuizAttemptsStore);
  const customStats = customAttempts ? customSubjectStats(customAttempts) : [];
  const today = useToday();

  const totalMinutes = DEMO_DAILY_MINUTES.reduce((a, b) => a + b, 0);
  const activity = DEMO_DAILY_MINUTES.map((minutes, i) => ({
    day: today
      ? format(subDays(today, DEMO_DAILY_MINUTES.length - 1 - i), "d MMM")
      : `Day ${i + 1}`,
    minutes,
  }));
  const sorted = attempts ? [...attempts].sort((a, b) => b.takenAt.localeCompare(a.takenAt)) : [];
  const weak = attempts ? weakAreas(attempts) : [];
  const avgs = attempts ? averageBySubject(attempts) : {};
  const customCount = customAttempts?.length ?? 0;
  const ownAttempts = (attempts?.filter((a) => !a.isDemo).length ?? 0) + customCount;
  const allQuizCount = (attempts?.length ?? 0) + customCount;

  return (
    <>
      <PageHeader
        title="My Progress"
        description="See how your learning is going and where to focus next."
        actions={<DemoBadge label="Includes demo records" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Study time (14 days)"
          value={`${Math.round(totalMinutes / 6) / 10} h`}
          hint={<DemoBadge />}
          icon={<Clock />}
        />
        <StatCard
          label="Study sessions"
          value={DEMO_STUDY_SESSIONS.length}
          hint={<DemoBadge />}
          icon={<BookOpenCheck />}
        />
        <StatCard
          label="Quizzes taken"
          value={attempts ? allQuizCount : "–"}
          hint={`${ownAttempts} by you · ${allQuizCount - ownAttempts} demo`}
          icon={<ListChecks />}
        />
        <StatCard
          label="Topics to revise"
          value={attempts ? weak.length : "–"}
          hint={`latest score under ${WEAK_THRESHOLD}%`}
          icon={<AlertTriangle />}
        />
      </div>

      <WeeklySummaryCard className="mt-6" />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Learning activity</CardTitle>
            <DemoBadge />
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
              <BarChart data={activity} margin={{ left: 0, right: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <RevisionDueCard limit={5} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <WeakAreasCard className="lg:col-span-2" limit={6} />
        <SurpriseMeCard />
      </div>

      <AchievementsCard className="mt-4" />

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Subject progress</CardTitle>
          <DemoBadge label="Demo mastery" />
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {SUBJECTS.map((s) => {
            const mastery = DEMO_SUBJECT_PROGRESS[s.id];
            return (
              <div key={s.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className={cn("size-2 rounded-full", subjectStyle(s.id).dot)} />
                    {s.name}
                  </span>
                  <span className="text-muted-foreground">
                    {avgs[s.id] !== undefined && (
                      <span className="mr-2 text-xs">quiz avg {avgs[s.id]}%</span>
                    )}
                    <span className="font-medium text-foreground">{mastery}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", subjectStyle(s.id).bar)}
                    style={{ width: `${mastery}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Your own subjects</CardTitle>
        </CardHeader>
        <CardContent>
          {!customAttempts ? (
            <LoadingBlock />
          ) : customStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Take a quiz in Quiz Studio on a subject you type yourself (choose “Other — type your
              own”) and your scores will appear here.
            </p>
          ) : (
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {customStats.map((c) => (
                <div key={c.subjectName.toLowerCase()}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{c.subjectName}</span>
                    <span className="text-muted-foreground">
                      <span className="mr-2 text-xs">
                        {c.quizzes} {c.quizzes === 1 ? "quiz" : "quizzes"} · latest {c.latestPercent}%
                      </span>
                      <span className="font-medium text-foreground">avg {c.averagePercent}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${c.averagePercent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {c.topics.join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Quiz history</CardTitle>
          </CardHeader>
          <CardContent>
            {!attempts ? (
              <LoadingBlock />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Topic</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden md:table-cell">Level</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...(customAttempts ?? [])]
                    .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
                    .map((a) => (
                      <TableRow key={a.id} className="hover:bg-surface">
                        <TableCell>
                          <div className="font-medium">{a.topicName}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-glow">
                              {a.subjectName}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-success">
                              you
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {format(parseISO(a.takenAt), "d MMM")}
                        </TableCell>
                        <TableCell className="hidden capitalize text-muted-foreground md:table-cell">
                          {a.difficulty}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {a.correct}/{a.total}
                        </TableCell>
                      </TableRow>
                    ))}
                  {sorted.map((a) => (
                    <TableRow key={a.id} className="hover:bg-surface">
                      <TableCell>
                        <div className="font-medium">{getTopicName(a.subjectId, a.topicId)}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <SubjectTag id={a.subjectId} />
                          {a.isDemo ? (
                            <span className="text-[10px] uppercase tracking-wide text-warning">
                              demo
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-success">
                              you
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {format(parseISO(a.takenAt), "d MMM")}
                      </TableCell>
                      <TableCell className="hidden capitalize text-muted-foreground md:table-cell">
                        {a.difficulty}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {a.correct}/{a.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Study sessions</CardTitle>
            <DemoBadge />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {DEMO_STUDY_SESSIONS.map((s) => (
                <li key={s.id} className={cn("border-l-2 pl-3", subjectStyle(s.subjectId).border)}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{s.topic}</p>
                    <span className="text-xs text-muted-foreground">{s.durationMin} min</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.kind} ·{" "}
                    {s.daysAgo === 0
                      ? "Today"
                      : s.daysAgo === 1
                        ? "Yesterday"
                        : `${s.daysAgo} days ago`}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="size-3.5" /> Quizzes you take in Quiz Studio are marked “you”; sample
        records are marked “demo”.
      </p>
    </>
  );
}
