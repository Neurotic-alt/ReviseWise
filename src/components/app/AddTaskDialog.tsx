import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBJECTS } from "@/lib/data/subjects";
import type { SubjectId } from "@/lib/data/types";

export function SubjectSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: SubjectId;
  onChange: (v: SubjectId) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SubjectId)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUBJECTS.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AddTaskDialog({
  defaultDate,
  onAdd,
  trigger,
}: {
  defaultDate: string;
  onAdd: (t: { title: string; subjectId: SubjectId; date: string; durationMin: number }) => void;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState<SubjectId>("maths");
  const [date, setDate] = useState(defaultDate);
  const [duration, setDuration] = useState("30");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const minutes = Number(duration);
    if (!title.trim() || !date || !(minutes > 0)) return;
    onAdd({ title: title.trim(), subjectId, date, durationMin: Math.min(minutes, 480) });
    setTitle("");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDate(defaultDate);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border bg-card sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add study task</DialogTitle>
            <DialogDescription>Plan a focused session for one topic.</DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">What will you study?</Label>
              <Input
                id="task-title"
                value={title}
                maxLength={120}
                required
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Past paper: simultaneous equations"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-subject">Subject</Label>
              <SubjectSelect id="task-subject" value={subjectId} onChange={setSubjectId} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-date">Date</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={date}
                  required
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-duration">Minutes</Label>
                <Input
                  id="task-duration"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={duration}
                  required
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="hero">
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
