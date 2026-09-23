import { Clock } from "lucide-react";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CountdownBadge({
  remaining,
  ratio,
}: {
  remaining: number;
  ratio: number;
}) {
  const expired = remaining === 0;
  const warning = !expired && ratio > 0.8;

  return (
    <div
      data-testid="countdown"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-lg font-bold tabular-nums",
        expired && "bg-[var(--tone-poor-soft)] text-[var(--tone-poor)]",
        warning && "bg-[var(--tone-fair-soft)] text-[var(--tone-fair)]",
        !expired && !warning && "bg-muted text-foreground",
      )}
    >
      <Clock className="size-4" aria-hidden="true" />
      {formatClock(remaining)}
    </div>
  );
}
