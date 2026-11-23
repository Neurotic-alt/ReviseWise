import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Cloud,
  HardDrive,
  ListChecks,
  Minus,
  Target,
  Trophy,
  CheckCheck,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { EmptyState, LoadingBlock, PageHeader, StatCard, SubjectTag } from "@/components/app/common";
import {
  AchievementsCard,
  RevisionDueCard,
  SurpriseMeCard,
  WeakAreasCard,
  WeeklySummaryCard,
} from "@/components/app/learning";
import { useSyncStatus } from "@/lib/data/cloud-sync";
import { customQuizAttemptsStore, quizAttemptsStore } from "@/lib/data/stores";
import { getTopicName, subjectStyle } from "@/lib/data/subjects";
import {
  accuracyByDay,
  ownQuizRows,
  quizOverview,
  subjectAccuracy,
  topicPerformance,
  type TopicPerformance,
} from "@/lib/analytics";
import { useStore, useToday } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "My Progress — ReviseWise" },
      {
        name: "description",
        content:
          "Your quiz analytics: accuracy rate, exam marks, topic performance and what to revise next.",
      },
      { property: "og:title", content: "My Progress — ReviseWise" },
      {
        property: "og:description",
        content: "Quiz accuracy, marks and topic-by-topic performance from your saved quizzes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressPage,
});

const chartConfig = {
  accuracy: { label: "Accuracy %", color: "var(--primary)" },
} satisfies ChartConfig;

const STATUS = {
  strong: { label: "Strong", variant: "success" as const },
  developing: { label: "Developing", variant: "warning" as const },
  "needs-revision": { label: "Needs revision", variant: "danger" as const },
};

function ProgressPage() {
  const attempts = useStore(quizAttemptsStore);
  const customAttempts = useStore(customQuizAttemptsStore);
  const today = useToday();
  const sync = useSyncStatus();
  const ready = attempts !== undefined && customAttempts !== undefined;

  const rows = ready ? ownQuizRows(attempts, customAttempts) : [];
  const overview = quizOverview(rows);
  const topics = topicPerformance(rows);
  const subjects = subjectAccuracy(rows);
  const days = today ? accuracyByDay(rows, today) : [];
  const hasOwn = rows.length > 0;
  const signedIn = sync.state !== "guest";

  return (
    <>
      <PageHeader
        title="My Progress"
        description="Your real quiz results: accuracy, marks and how each topic is going."
        actions={
          <Badge variant="soft" className="gap-1">
            {signedIn ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}
            {signedIn ? "From your account" : "Saved in this browser"}
          </Badge>
        }
      />

      {!signedIn && (
        <p className="-mt-2 mb-4 text-xs text-muted-foreground">
          <Link to="/auth" className="text-primary-glow underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to keep your quiz results safe in your account and see them on any device.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Quizzes taken"
          value={ready ? overview.quizzes : "–"}
          hint={`${overview.questions} questions in total`}
          icon={<ListChecks />}
        />
        <StatCard
          label="Accuracy rate"
          value={ready ? (overview.accuracy === null ? "–" : `${overview.accuracy}%`) : "–"}
          hint={`${overview.correct} right of ${overview.attempted} answered`}
          icon={<Target />}
        />
        <StatCard
          label="Questions attempted"
          value={ready ? (overview.attemptRate === null ? "–" : `${overview.attemptRate}%`) : "–"}
          hint={`${overview.wrong} wrong · ${overview.skipped} skipped`}
          icon={<CheckCheck />}
        />
        <StatCard
          label="Exam marks"
          value={ready && overview.maxMarks > 0 ? `${overview.marks}/${overview.maxMarks}` : "–"}
          hint="JEE/NEET +4/−1 · others +1/0"
          icon={<Trophy />}
        />
      </div>

      {ready && !hasOwn && (
        <Card className="mt-4">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">No quizzes yet</p>
              <p className="text-sm text-muted-foreground">
                Take a quiz in Quiz Studio and your accuracy and topic performance will show up here.
              </p>
            </div>
            <Button asChild variant="hero">
              <Link to="/quiz">Take a quiz</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Accuracy over the last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            {!ready || !today ? (
              <LoadingBlock />
            ) : !hasOwn ? (
              <EmptyState title="Nothing to chart yet" description="Each day you take a quiz adds a bar." />
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
                <BarChart data={days} margin={{ left: 0, right: 0, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="accuracy" fill="var(--color-accuracy)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <RevisionDueCard limit={5} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Topic performance</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <LoadingBlock />
          ) : topics.length === 0 ? (
            <EmptyState
              title="No topics yet"
              description="Every topic you take a quiz on will appear here, weakest first."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Topic</TableHead>
                  <TableHead className="hidden sm:table-cell">Quizzes</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead className="hidden md:table-cell">Latest</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((t) => (
                  <TopicRow key={t.key} t={t} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Accuracy by subject</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <LoadingBlock />
          ) : subjects.length === 0 ? (
            <EmptyState title="No subjects yet" description="Take a quiz to see your accuracy per subject." />
          ) : (
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {subjects.map((s) => (
                <div key={s.subjectId ?? s.subjectName}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          s.subjectId ? subjectStyle(s.subjectId).dot : "bg-primary",
                        )}
                      />
                      {s.subjectName}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="mr-2 text-xs">
                        {s.correct}/{s.attempted} right · {s.topics}{" "}
                        {s.topics === 1 ? "topic" : "topics"}
                      </span>
                      <span className="font-medium text-foreground">
                        {s.accuracy === null ? "–" : `${s.accuracy}%`}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        s.subjectId ? subjectStyle(s.subjectId).bar : "bg-primary",
                      )}
                      style={{ width: `${s.accuracy ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WeeklySummaryCard className="mt-4" />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <WeakAreasCard className="lg:col-span-2" limit={6} />
        <SurpriseMeCard />
      </div>

      <AchievementsCard className="mt-4" />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Quiz history</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <LoadingBlock />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Topic</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Exam · level</TableHead>
                  <TableHead className="hidden sm:table-cell">Accuracy</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const attempted = r.correct + r.wrong;
                  return (
                    <TableRow key={`${r.takenAt}-${i}`} className="hover:bg-surface">
                      <TableCell>
                        <div className="font-medium">{r.topicName}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <SubjectLabel subjectId={r.subjectId} name={r.subjectName} />
                          <span className="text-[10px] uppercase tracking-wide text-success">you</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {format(parseISO(r.takenAt), "d MMM")}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {r.exam ?? "—"} · <span className="capitalize">{r.difficulty}</span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {attempted ? `${Math.round((r.correct / attempted) * 100)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {r.maxMarks ? `${r.marks ?? 0}/${r.maxMarks} marks` : `${r.correct}/${r.total}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {[...attempts]
                  .filter((a) => a.isDemo)
                  .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
                  .map((a) => (
                    <TableRow key={a.id} className="hover:bg-surface">
                      <TableCell>
                        <div className="font-medium">{getTopicName(a.subjectId, a.topicId)}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <SubjectTag id={a.subjectId} />
                          <span className="text-[10px] uppercase tracking-wide text-warning">demo</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {format(parseISO(a.takenAt), "d MMM")}
                      </TableCell>
                      <TableCell className="hidden capitalize text-muted-foreground md:table-cell">
                        {a.difficulty}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">—</TableCell>
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

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="size-3.5" /> Analytics use only quizzes you took (marked “you”). Sample
        records marked “demo” are shown in the history but never counted.
      </p>
    </>
  );
}

function SubjectLabel({ subjectId, name }: { subjectId: TopicPerformance["subjectId"]; name: string }) {
  if (subjectId) return <SubjectTag id={subjectId} />;
  return (
    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-glow">
      {name}
    </span>
  );
}

function TopicRow({ t }: { t: TopicPerformance }) {
  const status = STATUS[t.status];
  return (
    <TableRow className="hover:bg-surface">
      <TableCell>
        <div className="font-medium">{t.topicName}</div>
        <div className="mt-1">
          <SubjectLabel subjectId={t.subjectId} name={t.subjectName} />
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {t.quizzes} · {t.questions} Qs
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
            <div className="h-full rounded-full bg-primary" style={{ width: `${t.accuracy ?? 0}%` }} />
          </div>
          <span className="font-medium">{t.accuracy === null ? "–" : `${t.accuracy}%`}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {t.correct}/{t.attempted} right
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="inline-flex items-center gap-1">
          {t.latestPercent}%
          {t.change === null ? null : t.change > 0 ? (
            <span className="inline-flex items-center text-xs text-success">
              <ArrowUpRight className="size-3.5" />
              {t.change}
            </span>
          ) : t.change < 0 ? (
            <span className="inline-flex items-center text-xs text-destructive">
              <ArrowDownRight className="size-3.5" />
              {Math.abs(t.change)}
            </span>
          ) : (
            <Minus className="size-3.5 text-muted-foreground" />
          )}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
    </TableRow>
  );
}
