"use client";

import Link from "next/link";
import type { Activity, Word } from "@/lib/types";

/** 側欄一行放不下整串釋義，取第一個義項就夠認出是哪個字。 */
function shortDefinition(word: Word): string {
  const raw = word.definition_zh || word.definition_en || "";
  return raw.split(/[;；]/)[0].trim();
}

/** 側欄的字：上面單字與音標，下面一行釋義。整塊可以點，點了就去背那個字。 */
function PanelWord({ word, onPick }: { word: Word; onPick?: (word: Word) => void }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{word.word}</span>
        {word.phonetic ? (
          <span className="truncate text-xs text-muted-foreground">
            [{word.phonetic}]
          </span>
        ) : null}
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {shortDefinition(word)}
      </p>
    </>
  );

  return (
    <li className="border-b border-dotted border-border last:border-0">
      {onPick ? (
        <button
          type="button"
          data-testid={`panel-word-${word.id}`}
          title={`去背 ${word.word}`}
          className="w-full cursor-pointer px-1 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          onClick={() => onPick(word)}
        >
          {body}
        </button>
      ) : (
        <div className="px-1 py-2">{body}</div>
      )}
    </li>
  );
}

/* 背單字頁桌機版右邊的常駐欄。
 *
 * 只放拿得到的資料：這一輪的進度、書籤、這次在例句點開過的字。
 * 樣式稿上那個「連續天數」後端沒有，寧可不顯示也不要編一個數字。
 */
export function StudyPanel({
  index,
  total,
  bookmarks,
  bookmarkTotal,
  looked,
  activity,
  onPick,
}: {
  index: number;
  total: number;
  bookmarks: Word[];
  bookmarkTotal: number;
  looked: Word[];
  activity: Activity | null;
  onPick?: (word: Word) => void;
}) {
  return (
    <aside className="hidden w-60 shrink-0 space-y-6 border-l border-border pl-5 text-sm lg:block">
      <section>
        <h2 className="mb-2 text-xs tracking-wider text-primary">這一輪</h2>
        <dl className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <dt>第幾張</dt>
            <dd className="tabular-nums text-foreground">
              {total === 0 ? "尚未抽卡" : `${Math.min(index + 1, total)} / ${total}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>已評</dt>
            <dd className="tabular-nums text-foreground">{index}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-xs tracking-wider text-primary">學習歷程</h2>
        <dl className="space-y-1 text-muted-foreground">
          <div className="flex justify-between">
            <dt>待複習</dt>
            <dd className="tabular-nums text-foreground" data-testid="due-count">
              {activity ? activity.due : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>今天評過</dt>
            <dd className="tabular-nums text-foreground">{activity ? activity.today : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>連續天數</dt>
            <dd className="tabular-nums text-foreground">
              {activity ? activity.streak_days : "—"}
            </dd>
          </div>
        </dl>
        {activity && activity.due > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            抽卡會自動先抽到期的字，不用自己挑。
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-xs tracking-wider text-primary">
          書籤 {bookmarkTotal}
        </h2>
        {bookmarks.length === 0 ? (
          <p className="text-muted-foreground">
            還沒有標記，卡片右上角點書籤就會收進來。
          </p>
        ) : (
          <ul>
            {bookmarks.map((word) => (
              <PanelWord key={word.id} word={word} onPick={onPick} />
            ))}
          </ul>
        )}
        {bookmarkTotal > 0 ? (
          <Link
            href="/bookmarks"
            className="mt-2 inline-block text-primary underline underline-offset-4"
          >
            全部書籤
          </Link>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-xs tracking-wider text-primary">剛查過</h2>
        {looked.length === 0 ? (
          <p className="text-muted-foreground">
            點例句裡有虛線的字就會記在這裡。
          </p>
        ) : (
          <ul data-testid="looked-list">
            {looked.map((word) => (
              <PanelWord key={word.id} word={word} onPick={onPick} />
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
