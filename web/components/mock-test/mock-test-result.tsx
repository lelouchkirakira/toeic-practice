"use client";

import Link from "next/link";
import { BarChart3, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SCORE_BADGE_CLASS,
  SCORE_TEXT_CLASS,
  estimateToeicScore,
  formatDuration,
  scoreTone,
} from "@/lib/format";
import type { SessionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MockTestResult({
  result,
  onRestart,
}: {
  result: SessionResult;
  onRestart: () => void;
}) {
  const tone = scoreTone(result.score);
  const estimate = result.estimated_toeic_score ?? estimateToeicScore(result.score);

  return (
    <Card>
      <CardContent className="space-y-6 text-center">
        <h1 className="text-xl font-semibold">模擬考結果</h1>

        <div className="space-y-1">
          <p
            className={cn(
              "text-5xl font-bold tabular-nums",
              SCORE_TEXT_CLASS[tone],
            )}
            data-testid="mock-score"
          >
            {result.score}%
          </p>
          <p className="text-sm text-muted-foreground">
            答對 {result.correct_count} 題 / 共 {result.total_questions} 題
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">多益閱讀分數推估</p>
          <span
            data-testid="toeic-estimate"
            className={cn(
              "inline-block rounded-lg border px-5 py-2 text-xl font-bold tabular-nums",
              SCORE_BADGE_CLASS[tone],
            )}
          >
            {estimate}
          </span>
        </div>

        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" />
          作答時間 {formatDuration(result.time_spent_seconds)}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={onRestart}
            data-testid="mock-restart"
          >
            <RotateCcw data-icon="inline-start" />
            再考一次
          </Button>
          <Button asChild className="h-11 flex-1">
            <Link href="/stats">
              <BarChart3 data-icon="inline-start" />
              看統計
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
