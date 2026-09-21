"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SCORE_TEXT_CLASS,
  partLabel,
  scoreTone,
} from "@/lib/format";
import type { SessionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ScoreBoard({
  result,
  onRestart,
}: {
  result: SessionResult;
  onRestart: () => void;
}) {
  const tone = scoreTone(result.score);

  return (
    <Card>
      <CardContent className="space-y-6 text-center">
        <h1 className="text-xl font-semibold">這一輪練習完成</h1>

        <div className="space-y-1">
          <p
            className={cn(
              "text-5xl font-bold tabular-nums",
              SCORE_TEXT_CLASS[tone],
            )}
            data-testid="score-value"
          >
            {result.score}%
          </p>
          <p className="text-sm text-muted-foreground">
            答對 {result.correct_count} 題 / 共 {result.total_questions} 題
          </p>
        </div>

        <dl className="flex justify-center gap-8 text-sm">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">模式</dt>
            <dd className="font-medium">練習</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">題型</dt>
            <dd className="font-medium">{partLabel(result.part)}</dd>
          </div>
        </dl>

        <Button
          size="lg"
          className="h-11 w-full"
          data-testid="restart-practice"
          onClick={onRestart}
        >
          <RotateCcw data-icon="inline-start" />
          再練一輪
        </Button>
      </CardContent>
    </Card>
  );
}
