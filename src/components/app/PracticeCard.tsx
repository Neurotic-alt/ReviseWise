import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { QuizQuestion } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function PracticeCard({ question }: { question: QuizQuestion }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  return (
    <div className="mt-3 rounded-xl border bg-background/40 p-3.5">
      <p className="text-sm font-medium">{question.prompt}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {question.options.map((opt, i) => {
          const isAnswer = i === question.answerIndex;
          const isPicked = i === picked;
          return (
            <button
              key={opt}
              type="button"
              disabled={answered}
              onClick={() => setPicked(i)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                !answered && "hover:border-primary/60 hover:bg-primary/10",
                answered && isAnswer && "border-success/60 bg-success/10",
                answered && isPicked && !isAnswer && "border-destructive/60 bg-destructive/10",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
          {picked === question.answerIndex ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          {question.explanation}
        </p>
      )}
    </div>
  );
}
