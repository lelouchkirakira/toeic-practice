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
        expired && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
        warning && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        !expired && !warning && "bg-muted text-foreground",
      )}
    >
      <Clock className="size-4" aria-hidden="true" />
      {formatClock(remaining)}
    </div>
  );
}
