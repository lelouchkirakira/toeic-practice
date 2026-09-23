import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeedbackPanel({
  isCorrect,
  explanation,
  className,
}: {
  isCorrect: boolean;
  explanation?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
          isCorrect
            ? "bg-[var(--tone-good-soft)] text-[var(--tone-good)]"
            : "bg-[var(--tone-poor-soft)] text-[var(--tone-poor)]",
        )}
      >
        {isCorrect ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <X className="size-4" aria-hidden="true" />
        )}
        {isCorrect ? "答對了" : "答錯了"}
      </div>
      {explanation ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {explanation}
        </p>
      ) : null}
    </div>
  );
}
