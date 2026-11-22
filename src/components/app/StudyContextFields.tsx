import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { settingsStore } from "@/lib/data/stores";
import { SUBJECTS } from "@/lib/data/subjects";
import type { SubjectId } from "@/lib/data/types";
import {
  ANY_TOPIC,
  CUSTOM,
  EXAMS,
  MAX_CUSTOM_CHARS,
  examFromLabel,
  getExam,
  levelFor,
  type ExamId,
  type StudyChoice,
} from "@/lib/study-context";
import { cn } from "@/lib/utils";

/** Picker state, starting from the exam and class saved in Settings. */
export function useStudyChoice(init: { subject?: SubjectId | undefined; topic?: string | undefined; customSubject?: string | undefined; topicOptional?: boolean }) {
  const [choice, setChoiceState] = useState<StudyChoice>(() => {
    const exam: ExamId = "cbse";
    const subject: SubjectId | typeof CUSTOM = init.customSubject ? CUSTOM : (init.subject ?? "maths");
    const firstTopic = subject === CUSTOM ? CUSTOM : (SUBJECTS.find((x) => x.id === subject)?.topics[0]?.id ?? CUSTOM);
    return {
      exam,
      level: levelFor(exam, undefined),
      subject,
      customSubject: init.customSubject ?? "",
      topic: init.topic ?? (init.topicOptional ? ANY_TOPIC : firstTopic),
      customTopic: "",
    };
  });

  // Saved exam and class live in the browser, so load them after the first render.
  useEffect(() => {
    const s = settingsStore.get();
    const exam = examFromLabel(s.curriculum);
    setChoiceState((prev) => ({ ...prev, exam, level: levelFor(exam, s.yearGroup) }));
  }, []);

  const setChoice = (patch: Partial<StudyChoice>) =>
    setChoiceState((prev) => {
      const next = { ...prev, ...patch };
      if (patch.exam || patch.level) {
        // Remember the exam and class for both pages.
        settingsStore.set((s) => ({ ...s, curriculum: getExam(next.exam).label, yearGroup: next.level }));
      }
      return next;
    });

  return [choice, setChoice] as const;
}

interface Props {
  choice: StudyChoice;
  onChange: (patch: Partial<StudyChoice>) => void;
  /** Companion lets the student skip the topic. */
  topicOptional?: boolean;
  /** "grid" for Quiz Studio, "stack" for the Companion sidebar. */
  layout?: "grid" | "stack";
}

export function StudyContextFields({ choice, onChange, topicOptional = false, layout = "grid" }: Props) {
  const exam = getExam(choice.exam);
  const builtIn = choice.subject === CUSTOM ? undefined : SUBJECTS.find((s) => s.id === choice.subject);
  const typedSubject = choice.subject === CUSTOM;
  const typedTopic = typedSubject || choice.topic === CUSTOM;

  return (
    <div className={cn("gap-4", layout === "grid" ? "grid sm:grid-cols-2" : "flex flex-col")}>
      <Field label="Exam / Curriculum">
        <Select
          value={choice.exam}
          onValueChange={(v) => {
            const id = v as ExamId;
            onChange({ exam: id, level: levelFor(id, choice.level) });
          }}
        >
          <SelectTrigger aria-label="Exam / Curriculum">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXAMS.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Class / Level">
        <Select value={choice.level} onValueChange={(v) => onChange({ level: v })}>
          <SelectTrigger aria-label="Class / Level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {exam.levels.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Subject">
        <Select
          value={choice.subject}
          onValueChange={(v) => {
            if (v === CUSTOM) {
              onChange({ subject: CUSTOM, topic: CUSTOM });
              return;
            }
            const id = v as SubjectId;
            const first = SUBJECTS.find((s) => s.id === id)?.topics[0]?.id ?? CUSTOM;
            onChange({ subject: id, topic: topicOptional ? ANY_TOPIC : first });
          }}
        >
          <SelectTrigger aria-label="Subject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Other — type your own</SelectItem>
          </SelectContent>
        </Select>
        {typedSubject && (
          <Input
            className="mt-2"
            aria-label="Custom subject"
            placeholder="e.g. Accountancy, Economics, Data Structures"
            maxLength={MAX_CUSTOM_CHARS}
            value={choice.customSubject}
            onChange={(e) => onChange({ customSubject: e.target.value })}
          />
        )}
      </Field>
      <Field label={topicOptional ? "Topic (optional)" : "Topic"}>
        {!typedSubject && builtIn && (
          <Select value={choice.topic} onValueChange={(v) => onChange({ topic: v })}>
            <SelectTrigger aria-label="Topic">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {topicOptional && <SelectItem value={ANY_TOPIC}>Any topic</SelectItem>}
              {builtIn.topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Other — type your own</SelectItem>
            </SelectContent>
          </Select>
        )}
        {typedTopic && (
          <Input
            className={cn(!typedSubject && "mt-2")}
            aria-label="Custom topic"
            placeholder="e.g. Quadratic equations, Electrostatics"
            maxLength={MAX_CUSTOM_CHARS}
            value={choice.customTopic}
            onChange={(e) => onChange({ customTopic: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
