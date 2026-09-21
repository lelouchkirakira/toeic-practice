"use client";

import { cn } from "@/lib/utils";

export type OptionState = "idle" | "selected" | "correct" | "incorrect" | "muted";

const SHELL: Record<OptionState, string> = {
  idle: "border-border bg-card hover:border-primary/50 hover:bg-muted/60",
  selected: "border-primary bg-primary/5",
  correct: "border-emerald-500 bg-emerald-500/10",
  incorrect: "border-rose-500 bg-rose-500/10",
  muted: "border-border bg-card opacity-55",
};

const MARKER: Record<OptionState, string> = {
  idle: "bg-muted text-muted-foreground",
  selected: "bg-primary text-primary-foreground",
  correct: "bg-emerald-500 text-white",
  incorrect: "bg-rose-500 text-white",
  muted: "bg-muted text-muted-foreground",
};

export function OptionButton({
  marker,
  label,
  state,
  disabled,
  onClick,
}: {
  marker: string;
  label: string;
  state: OptionState;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={state === "selected"}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border-2 px-3 py-3 text-left text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default",
        SHELL[state],
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          MARKER[state],
        )}
      >
        {marker}
      </span>
      <span className="min-w-0 break-words">{label}</span>
    </button>
  );
}
