import type { Subject, SubjectColor, SubjectId } from "./types";

export const SUBJECTS: Subject[] = [
  {
    id: "maths",
    name: "Mathematics",
    color: "subject-1",
    topics: [
      { id: "algebra", name: "Algebra" },
      { id: "geometry", name: "Geometry" },
    ],
  },
  {
    id: "physics",
    name: "Physics",
    color: "subject-2",
    topics: [
      { id: "forces", name: "Forces & Motion" },
      { id: "electricity", name: "Electricity" },
    ],
  },
  {
    id: "biology",
    name: "Biology",
    color: "subject-3",
    topics: [
      { id: "cells", name: "Cell Biology" },
      { id: "ecology", name: "Ecology" },
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    color: "subject-4",
    topics: [
      { id: "atoms", name: "Atomic Structure" },
      { id: "reactions", name: "Chemical Reactions" },
    ],
  },
  {
    id: "english",
    name: "English",
    color: "subject-5",
    topics: [
      { id: "grammar", name: "Grammar & Punctuation" },
      { id: "literature", name: "Literary Techniques" },
    ],
  },
  {
    id: "history",
    name: "History",
    color: "subject-6",
    topics: [
      { id: "ww1", name: "World War I" },
      { id: "civil-rights", name: "Civil Rights Movements" },
    ],
  },
];

export function getSubject(id: SubjectId): Subject {
  const subject = SUBJECTS.find((s) => s.id === id);
  if (!subject) throw new Error(`Unknown subject ${id}`);
  return subject;
}

export function getTopicName(subjectId: SubjectId, topicId: string): string {
  return getSubject(subjectId).topics.find((t) => t.id === topicId)?.name ?? topicId;
}

/** Literal class names per subject colour so Tailwind keeps them. */
export const SUBJECT_STYLES: Record<
  SubjectColor,
  { dot: string; text: string; soft: string; bar: string; border: string }
> = {
  "subject-1": {
    dot: "bg-subject-1",
    text: "text-subject-1",
    soft: "bg-subject-1/15 text-subject-1",
    bar: "bg-subject-1",
    border: "border-l-subject-1",
  },
  "subject-2": {
    dot: "bg-subject-2",
    text: "text-subject-2",
    soft: "bg-subject-2/15 text-subject-2",
    bar: "bg-subject-2",
    border: "border-l-subject-2",
  },
  "subject-3": {
    dot: "bg-subject-3",
    text: "text-subject-3",
    soft: "bg-subject-3/15 text-subject-3",
    bar: "bg-subject-3",
    border: "border-l-subject-3",
  },
  "subject-4": {
    dot: "bg-subject-4",
    text: "text-subject-4",
    soft: "bg-subject-4/15 text-subject-4",
    bar: "bg-subject-4",
    border: "border-l-subject-4",
  },
  "subject-5": {
    dot: "bg-subject-5",
    text: "text-subject-5",
    soft: "bg-subject-5/15 text-subject-5",
    bar: "bg-subject-5",
    border: "border-l-subject-5",
  },
  "subject-6": {
    dot: "bg-subject-6",
    text: "text-subject-6",
    soft: "bg-subject-6/15 text-subject-6",
    bar: "bg-subject-6",
    border: "border-l-subject-6",
  },
};

export function subjectStyle(id: SubjectId) {
  return SUBJECT_STYLES[getSubject(id).color];
}
