const PART_LABELS: Record<string, string> = {
  "5": "Part 5 單句填空",
  "6": "Part 6 段落填空",
  "7": "Part 7 閱讀測驗",
  mixed: "綜合題",
  vocab: "單字測驗",
};

const PART_SHORT_LABELS: Record<string, string> = {
  "5": "Part 5",
  "6": "Part 6",
  "7": "Part 7",
  mixed: "綜合題",
  vocab: "單字測驗",
};

export function partLabel(part: string): string {
  return PART_LABELS[part] ?? `Part ${part}`;
}

export function partShortLabel(part: string): string {
  return PART_SHORT_LABELS[part] ?? `Part ${part}`;
}

export function modeLabel(mode: string): string {
  return mode === "mock" ? "模擬考" : "練習";
}

export function passageTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    email: "電子郵件",
    notice: "公告",
    advertisement: "廣告",
    memo: "備忘錄",
    letter: "書信",
    article: "文章",
    announcement: "通知",
    form: "表單",
    schedule: "行程表",
    report: "報告",
  };
  return labels[type] ?? type;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m} 分 ${s} 秒`;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${month} 月 ${day} 日 ${hh}:${mm}`;
}

/** 級距沿用 Vue 版模擬考結果的對照表 */
export function estimateToeicScore(accuracy: number): string {
  if (accuracy >= 90) return "450-495";
  if (accuracy >= 80) return "400-445";
  if (accuracy >= 70) return "350-395";
  if (accuracy >= 60) return "300-345";
  return "Below 300";
}

export type ScoreTone = "good" | "fair" | "poor";

export function scoreTone(score: number): ScoreTone {
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  return "poor";
}

export const SCORE_TEXT_CLASS: Record<ScoreTone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-rose-600 dark:text-rose-400",
};

export const SCORE_BAR_CLASS: Record<ScoreTone, string> = {
  good: "bg-emerald-500",
  fair: "bg-amber-500",
  poor: "bg-rose-500",
};

export const SCORE_BADGE_CLASS: Record<ScoreTone, string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fair: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  poor: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
