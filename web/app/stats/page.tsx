"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorNotice, InfoNotice, LoadingBlock } from "@/components/status";
import {
  errorMessage,
  fetchActivity,
  fetchStatsHistory,
  fetchStatsOverview,
} from "@/lib/api";
import {
  SCORE_BADGE_CLASS,
  SCORE_BAR_CLASS,
  SCORE_TEXT_CLASS,
  formatDateTime,
  formatDuration,
  modeLabel,
  partShortLabel,
  scoreTone,
} from "@/lib/format";
import { ActivityChart } from "@/components/vocabulary/activity-chart";
import type { Activity, SessionHistory, StatsOverview } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function StatsPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [history, setHistory] = useState<SessionHistory[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [overviewData, historyData] = await Promise.all([
        fetchStatsOverview(),
        fetchStatsHistory(20),
      ]);
      setOverview(overviewData);
      setActivity(await fetchActivity(30).catch(() => null));
      setHistory(historyData);
    } catch (e) {
      setError(errorMessage(e, "載入統計失敗"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) return <LoadingBlock label="正在載入統計" />;
  if (error) return <ErrorNotice message={error} />;

  // 沒做過測驗不代表沒學習：背單字的活動是另一份資料，有就要顯示。
  if (!overview || overview.total_sessions === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold">統計</h1>
        <InfoNotice message="還沒有測驗紀錄。做一輪練習或模擬考之後就會看到答題數字。" />
        {activity && activity.days.some((day) => day.count > 0) ? (
          <Card>
            <CardHeader>
              <CardTitle>背單字活動</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart activity={activity} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const overallTone = scoreTone(overview.overall_accuracy);
  const partEntries = Object.entries(overview.part_accuracy);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">統計</h1>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile label="測驗場次" value={String(overview.total_sessions)} />
        <StatTile label="作答題數" value={String(overview.total_questions)} />
        <StatTile
          label="整體正確率"
          value={`${overview.overall_accuracy}%`}
          className={SCORE_TEXT_CLASS[overallTone]}
          testId="overall-accuracy"
        />
      </div>

      {activity && activity.days.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>背單字活動</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart activity={activity} />
          </CardContent>
        </Card>
      ) : null}

      {partEntries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>各題型正確率</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {partEntries.map(([part, accuracy]) => {
              const tone = scoreTone(accuracy);
              return (
                <div key={part} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm font-medium">
                    {partShortLabel(part)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", SCORE_BAR_CLASS[tone])}
                      style={{ width: `${Math.min(100, Math.max(0, accuracy))}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right text-sm tabular-nums",
                      SCORE_TEXT_CLASS[tone],
                    )}
                  >
                    {accuracy}%
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {overview.weak_categories.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>需要加強的文法</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overview.weak_categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>歷史場次</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table data-testid="history-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">日期</TableHead>
                    <TableHead className="whitespace-nowrap">模式</TableHead>
                    <TableHead className="whitespace-nowrap">題型</TableHead>
                    <TableHead className="whitespace-nowrap">分數</TableHead>
                    <TableHead className="whitespace-nowrap">答對</TableHead>
                    <TableHead className="whitespace-nowrap">用時</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((session) => {
                    const tone = scoreTone(session.score);
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(session.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {modeLabel(session.mode)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {partShortLabel(session.part)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-block rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums",
                              SCORE_BADGE_CLASS[tone],
                            )}
                          >
                            {session.score}%
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {session.correct_count} / {session.total_questions}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDuration(session.time_spent_seconds)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  className,
  testId,
}: {
  label: string;
  value: string;
  className?: string;
  testId?: string;
}) {
  return (
    <Card>
      <CardContent className="px-2 text-center sm:px-4">
        <p
          className={cn("text-2xl font-bold tabular-nums", className)}
          data-testid={testId}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
