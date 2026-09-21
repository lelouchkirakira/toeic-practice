"use client";

import { cn } from "@/lib/utils";

export function NavDots({
  count,
  current,
  isDone,
  onSelect,
}: {
  count: number;
  current: number;
  isDone: (index: number) => boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="nav-dots">
      {Array.from({ length: count }, (_, i) => {
        const active = i === current;
        const done = isDone(i);
        return (
          <button
            key={i}
            type="button"
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(i)}
            className={cn(
              "size-8 rounded-md border text-xs font-semibold tabular-nums transition-colors",
              done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
              active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
