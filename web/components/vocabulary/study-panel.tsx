"use client";

import Link from "next/link";
import type { Word } from "@/lib/types";

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
}: {
  index: number;
  total: number;
  bookmarks: Word[];
  bookmarkTotal: number;
  looked: Word[];
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
        <h2 className="mb-2 text-xs tracking-wider text-primary">
          書籤 {bookmarkTotal}
        </h2>
        {bookmarks.length === 0 ? (
          <p className="text-muted-foreground">
            還沒有標記，卡片右上角點書籤就會收進來。
          </p>
        ) : (
          <ul className="space-y-1">
            {bookmarks.map((word) => (
              <li
                key={word.id}
                className="flex justify-between gap-2 border-b border-dotted border-border pb-1"
              >
                <span className="truncate">{word.word}</span>
                <span className="truncate text-muted-foreground">
                  {word.definition_zh || word.definition_en}
                </span>
              </li>
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
          <ul className="space-y-1" data-testid="looked-list">
            {looked.map((word) => (
              <li key={word.id} className="flex justify-between gap-2">
                <span className="truncate">{word.word}</span>
                <span className="truncate text-muted-foreground">
                  {word.definition_zh || word.definition_en}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
