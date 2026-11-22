import { useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Globe, Lock, Save, ShieldCheck, SlidersHorizontal, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { LoadingBlock, PageHeader } from "@/components/app/common";
import { settingsStore } from "@/lib/data/stores";
import type { StudentSettings } from "@/lib/data/types";
import { resetAllStores, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ReviseWise" },
      {
        name: "description",
        content:
          "Manage your ReviseWise profile, language, learning preferences, account and privacy.",
      },
      { property: "og:title", content: "Settings — ReviseWise" },
      {
        property: "og:description",
        content: "Profile, language, learning preferences, account and privacy settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const YEAR_GROUPS = ["Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"];
const CURRICULA = [
  "GCSE",
  "IGCSE",
  "A Level",
  "IB MYP",
  "IB Diploma",
  "CBSE",
  "ICSE",
  "AP / US High School",
  "Other",
];
const COUNTRIES = [
  "United Kingdom",
  "India",
  "United States",
  "United Arab Emirates",
  "Singapore",
  "Australia",
  "Canada",
  "Nigeria",
  "Other",
];
const LANGUAGES = [
  "English",
  "हिन्दी (Hindi)",
  "Español",
  "Français",
  "العربية (Arabic)",
  "中文 (Chinese)",
];
const STYLES: { value: StudentSettings["explanationStyle"]; label: string; hint: string }[] = [
  { value: "step-by-step", label: "Step by step", hint: "Full worked reasoning" },
  { value: "concise", label: "Concise", hint: "Short, to the point" },
  { value: "visual", label: "Visual", hint: "Diagrams and examples" },
];

function SettingsPage() {
  const settings = useStore(settingsStore);
  return (
    <>
      <PageHeader title="Settings" description="Make ReviseWise work the way you learn." />
      {settings ? <SettingsForm initial={settings} /> : <LoadingBlock rows={6} />}
    </>
  );
}

function SettingsForm({ initial }: { initial: StudentSettings }) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof StudentSettings>(key: K, value: StudentSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim().slice(0, 40);
    if (!name) {
      toast.error("Please enter your name");
      return;
    }
    settingsStore.set(() => ({ ...form, name }));
    toast.success("Settings saved");
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-4 pb-24">
      <Section icon={<User />} title="Student profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Display name" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              maxLength={40}
              onChange={(e) => set("name", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Year group" htmlFor="year">
            <SimpleSelect
              id="year"
              value={form.yearGroup}
              options={YEAR_GROUPS}
              onChange={(v) => set("yearGroup", v)}
            />
          </FieldRow>
          <FieldRow label="Country" htmlFor="country">
            <SimpleSelect
              id="country"
              value={form.country}
              options={COUNTRIES}
              onChange={(v) => set("country", v)}
            />
          </FieldRow>
          <FieldRow label="Curriculum" htmlFor="curriculum">
            <SimpleSelect
              id="curriculum"
              value={form.curriculum}
              options={CURRICULA}
              onChange={(v) => set("curriculum", v)}
            />
          </FieldRow>
        </div>
      </Section>

      <Section icon={<Globe />} title="Preferred language">
        <FieldRow
          label="App and explanation language"
          htmlFor="language"
          hint="Translations are coming soon; the app is currently in English."
        >
          <SimpleSelect
            id="language"
            value={form.language}
            options={LANGUAGES}
            onChange={(v) => set("language", v)}
          />
        </FieldRow>
      </Section>

      <Section icon={<SlidersHorizontal />} title="Learning preferences">
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">Explanation style</p>
            <div
              role="radiogroup"
              aria-label="Explanation style"
              className="grid gap-2 sm:grid-cols-3"
            >
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={form.explanationStyle === s.value}
                  onClick={() => set("explanationStyle", s.value)}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left transition-colors",
                    form.explanationStyle === s.value
                      ? "border-primary/60 bg-primary/15"
                      : "hover:bg-card-elevated",
                  )}
                >
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <SliderRow
            label="Study session length"
            value={form.sessionLengthMin}
            min={15}
            max={90}
            step={5}
            onChange={(v) => set("sessionLengthMin", v)}
          />
          <SliderRow
            label="Daily study goal"
            value={form.dailyGoalMin}
            min={15}
            max={240}
            step={15}
            onChange={(v) => set("dailyGoalMin", v)}
          />
          <SwitchRow
            id="reminders"
            label="Study reminders"
            hint="Show a reminder on the dashboard when today's tasks aren't done."
            checked={form.reminders}
            onChange={(v) => set("reminders", v)}
          />
        </div>
      </Section>

      <Section icon={<Lock />} title="Account">
        <div className="space-y-4">
          <FieldRow
            label="Email"
            htmlFor="email"
            hint="Accounts and sign-in will be added in a later version. Your data is stored only in this browser for now."
          >
            <Input id="email" type="email" placeholder="Not signed in" disabled />
          </FieldRow>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled>
              Change password
            </Button>
            <Button type="button" variant="outline" disabled>
              Sign out
            </Button>
          </div>
        </div>
      </Section>

      <Section icon={<ShieldCheck />} title="Privacy">
        <div className="space-y-5">
          <SwitchRow
            id="analytics"
            label="Share anonymous usage data"
            hint="Help improve ReviseWise. Never includes your name or answers."
            checked={form.shareAnonymousAnalytics}
            onChange={(v) => set("shareAnonymousAnalytics", v)}
          />
          <SwitchRow
            id="chat-history"
            label="Keep AI Companion chat history"
            hint="When off, chats are cleared as soon as you leave the page."
            checked={form.saveChatHistory}
            onChange={(v) => set("saveChatHistory", v)}
          />
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Reset all data</p>
              <p className="text-xs text-muted-foreground">
                Removes your tasks, exams, quiz results and settings from this browser and restores
                the demo data.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  <Trash2 /> Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card">
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all ReviseWise data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This can't be undone. Everything you've added in this browser will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      resetAllStores();
                      toast.success("Data reset");
                      window.location.reload();
                    }}
                  >
                    Reset data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border bg-card/95 p-3 shadow-card backdrop-blur">
        <span className="mr-auto pl-2 text-sm text-muted-foreground">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button type="button" variant="ghost" disabled={!dirty} onClick={() => setForm(initial)}>
          Discard
        </Button>
        <Button type="submit" variant="hero" disabled={!dirty}>
          <Save /> Save settings
        </Button>
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-primary-glow">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FieldRow({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SimpleSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value} min</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0] ?? value)}
        aria-label={label}
      />
    </div>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
