"use client";

import type { Activity } from "@/lib/types";

/* 最近三十天的背單字活動。
 *
 * 資料來自每次評分寫下的事件，不是熟練度那張表：那張表只留最後一次的結果，
 * 算不出哪一天評了幾個字。
 */
export function ActivityChart({ activity }: { activity: Activity }) {
  const days = activity.days;
  const peak = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const active = days.filter((d) => d.count > 0).length;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">三十天評過</dt>
          <dd className="text-lg font-semibold tabular-nums">{total}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">有背的天數</dt>
          <dd className="text-lg font-semibold tabular-nums">{active}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">待複習</dt>
          <dd className="text-lg font-semibold tabular-nums" data-testid="stats-due">
            {activity.due}
          </dd>
        </div>
      </dl>

      <div className="flex h-20 items-end gap-[3px]" data-testid="activity-bars">
        {days.map((day) => (
          <span
            key={day.date}
            title={`${day.date} 評了 ${day.count} 個`}
            style={{ height: `${Math.max(3, (day.count / peak) * 100)}%` }}
            className={
              day.count > 0
                ? "flex-1 bg-primary/70"
                : "flex-1 bg-muted"
            }
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{days[0]?.date.slice(5)}</span>
        <span>連續 {activity.streak_days} 天</span>
        <span>{days[days.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
