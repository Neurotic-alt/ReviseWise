import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addWeeks, format, isSameDay, parseISO } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, GraduationCap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AddTaskDialog, SubjectSelect } from "@/components/app/AddTaskDialog";
import { EmptyState, LoadingBlock, PageHeader, SubjectTag } from "@/components/app/common";
import { setTaskDone } from "@/lib/data/actions";
import { examsStore, tasksStore } from "@/lib/data/stores";
import { SUBJECTS, subjectStyle } from "@/lib/data/subjects";
import type { SubjectId } from "@/lib/data/types";
import {
  completionPercent,
  daysUntil,
  getWeekDays,
  newId,
  tasksOn,
  toISODate,
  upcomingExams,
} from "@/lib/planner";
import { useStore, useToday } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Revision Planner — ReviseWise" },
      {
        name: "description",
        content: "Plan your week of revision, track completed study tasks and count down to exams.",
      },
      { property: "og:title", content: "Revision Planner — ReviseWise" },
      {
        property: "og:description",
        content: "A weekly revision calendar with study tasks, subjects and exam countdowns.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlannerPage,
});

function PlannerPage() {
  const today = useToday();
  const tasks = useStore(tasksStore);
  const exams = useStore(examsStore);
  const [weekOffset, setWeekOffset] = useState(0);

  if (!today || !tasks || !exams) {
    return (
      <>
        <PageHeader
          title="Revision Planner"
          description="Plan your week and stay ahead of your exams."
        />
        <LoadingBlock rows={5} />
      </>
    );
  }

  const days = getWeekDays(addWeeks(today, weekOffset));
  const weekKeys = days.map(toISODate);
  const weekTasks = tasks.filter((t) => weekKeys.includes(t.date));
  const weekMinutes = weekTasks.reduce((s, t) => s + t.durationMin, 0);
  const todayKey = toISODate(today);

  const addTask = (t: {
    title: string;
    subjectId: SubjectId;
    date: string;
    durationMin: number;
  }) => {
    tasksStore.set((prev) => [...prev, { id: newId("t"), done: false, ...t }]);
    toast.success("Task added");
  };

  return (
    <>
      <PageHeader
        title="Revision Planner"
        description="Plan your week and stay ahead of your exams."
        actions={
          <AddTaskDialog
            defaultDate={weekKeys.includes(todayKey) ? todayKey : (weekKeys[0] ?? todayKey)}
            onAdd={addTask}
            trigger={
              <Button variant="hero">
                <Plus /> Add task
              </Button>
            }
          />
        }
      />

      <div className="grid gap-4">
        <div className="min-w-0 space-y-4">
          <div className="surface-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="Previous week"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Next week"
              >
                <ChevronRight />
              </Button>
              <div className="ml-1">
                <p className="font-display font-semibold">
                  {format(days[0] ?? today, "d MMM")} – {format(days[6] ?? today, "d MMM yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {weekTasks.length} tasks · {Math.round((weekMinutes / 60) * 10) / 10} hours
                  planned
                </p>
              </div>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                  This week
                </Button>
              )}
            </div>
            <div className="w-full sm:w-48">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Week completed</span>
                <span>{completionPercent(weekTasks)}%</span>
              </div>
              <Progress value={completionPercent(weekTasks)} aria-label="Week completion" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
            {days.map((day) => {
              const key = toISODate(day);
              const dayTasks = tasksOn(tasks, key);
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={key}
                  className={cn(
                    "surface-card flex min-w-0 flex-col p-3 sm:min-h-40",
                    isToday && "border-primary/60 bg-gradient-soft",
                  )}
                >
                  <div className="mb-3 flex items-baseline justify-between 2xl:flex-col 2xl:items-start 2xl:gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {format(day, "EEE")}
                    </span>
                    <span
                      className={cn(
                        "font-display text-lg font-semibold",
                        isToday && "text-primary-glow",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <ul className="flex-1 space-y-2">
                    {dayTasks.map((t) => (
                      <li
                        key={t.id}
                        className={cn(
                          "group relative rounded-lg border-l-2 bg-background/50 p-2 pr-6",
                          subjectStyle(t.subjectId).border,
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="mt-0.5"
                            checked={t.done}
                            aria-label={`Mark "${t.title}" as done`}
                            onCheckedChange={(v) => setTaskDone(t.id, v === true)}
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 break-words text-xs leading-snug",
                              t.done && "text-muted-foreground line-through",
                            )}
                          >
                            {t.title}
                          </span>
                          <button
                            type="button"
                            aria-label={`Delete "${t.title}"`}
                            onClick={() =>
                              tasksStore.set((prev) => prev.filter((x) => x.id !== t.id))
                            }
                            className="absolute right-1.5 top-2 text-muted-foreground opacity-60 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className={cn("mt-1 pl-6 text-[11px]", subjectStyle(t.subjectId).text)}>
                          {t.durationMin} min
                        </p>
                      </li>
                    ))}
                  </ul>
                  <AddTaskDialog
                    defaultDate={key}
                    onAdd={addTask}
                    trigger={
                      <button
                        type="button"
                        className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                        aria-label={`Add task on ${format(day, "EEEE d MMMM")}`}
                      >
                        <Plus className="size-3" /> Add
                      </button>
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <SubjectTag key={s.id} id={s.id} />
            ))}
          </div>
        </div>

        <ExamPanel today={today} />
      </div>
    </>
  );
}

function ExamPanel({ today }: { today: Date }) {
  const exams = useStore(examsStore) ?? [];
  const [subjectId, setSubjectId] = useState<SubjectId>("maths");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!date) return;
    examsStore.set((prev) => [
      ...prev,
      {
        id: newId("e"),
        subjectId,
        title: title.trim() || `${SUBJECTS.find((s) => s.id === subjectId)?.name} exam`,
        date,
      },
    ]);
    setTitle("");
    setDate("");
    toast.success("Exam date added");
  };

  const upcoming = upcomingExams(exams, today);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-4 text-primary-glow" /> Exam dates
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming exams" description="Add your first exam date below." />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => {
              const days = daysUntil(e.date, today);
              return (
                <li key={e.id} className="flex items-center gap-3 rounded-xl bg-surface p-3">
                  <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/15">
                    <span className="font-display text-base font-semibold leading-none">
                      {days}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {days === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(e.date), "EEE d MMM yyyy")}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${e.title}`}
                    onClick={() => examsStore.set((prev) => prev.filter((x) => x.id !== e.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={add}
          className="space-y-3 border-t pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0"
        >
          <p className="text-sm font-medium">Add an exam</p>
          <div className="space-y-2">
            <Label htmlFor="exam-subject">Subject</Label>
            <SubjectSelect id="exam-subject" value={subjectId} onChange={setSubjectId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam-title">Exam name</Label>
            <Input
              id="exam-title"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chemistry Paper 2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam-date">Exam date</Label>
            <Input
              id="exam-date"
              type="date"
              required
              min={toISODate(today)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button type="submit" variant="soft" className="w-full">
            <CalendarPlus /> Add exam date
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
