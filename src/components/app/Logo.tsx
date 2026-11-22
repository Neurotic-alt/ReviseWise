import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
        <Sparkles className="size-4.5 text-primary-foreground" aria-hidden />
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Revise<span className="text-gradient-primary">Wise</span>
        </span>
      )}
    </div>
  );
}
