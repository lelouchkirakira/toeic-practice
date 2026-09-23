"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNotice, LoadingBlock } from "@/components/status";
import {
  errorMessage,
  fetchBookmarks,
  fetchProgressWords,
  saveBookmark,
  type ProgressLevel,
} from "@/lib/api";
import {
  REVIEW_FLAG,
  setReviewFilter,
  setStudyWord,
} from "@/lib/review-handoff";
import type { Word } from "@/lib/types";

const LIST_LIMIT = 200;

/* 「我的單字」把四份清單放在同一個地方：書籤是自己標的，其餘三份是評分的結果。
 * 每一份都能整批去背，也能點單一個字去背。 */
const TABS = [
  { key: "bookmark", label: "書籤", empty: "還沒有標記。背單字時在卡片右上角點書籤就會收進來。" },
  { key: "due", label: "該複習", empty: "目前沒有到期的字。評過之後會依熟練度排時間，到期才會出現在這裡。" },
  { key: "unknown", label: "不會", empty: "還沒有按過不會的字。" },
  { key: "fuzzy", label: "模糊", empty: "還沒有按過模糊的字。" },
  { key: "known", label: "會了", empty: "還沒有按過會了的字。" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function MyWordsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("bookmark");
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (key: TabKey) => {
    setIsLoading(true);
    setError("");
    try {
      const data =
        key === "bookmark"
          ? await fetchBookmarks(LIST_LIMIT)
          : await fetchProgressWords(key as ProgressLevel, LIST_LIMIT);
      setWords(data.words);
      setTotal(data.total);
    } catch (e) {
      setError(errorMessage(e, "載入失敗"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // React 19 的 react-hooks/set-state-in-effect：包 microtask 避免 cascading render
  useEffect(() => {
    queueMicrotask(() => void load(tab));
  }, [load, tab]);

  // 書籤是自己標的，移除就真的移除；其餘三份是評分結果，只能靠再評一次改變。
  async function removeBookmark(word: Word, position: number) {
    setWords((list) => list.filter((item) => item.id !== word.id));
    setTotal((value) => Math.max(0, value - 1));
    setError("");
    try {
      await saveBookmark(word.id, false);
    } catch (e) {
      setWords((list) => {
        const next = [...list];
        next.splice(position, 0, word);
        return next;
      });
      setTotal((value) => value + 1);
      setError(errorMessage(e, "移除書籤失敗"));
    }
  }

  function studyAll() {
    if (tab === "bookmark") {
      try {
        window.sessionStorage.setItem(REVIEW_FLAG, "1");
      } catch {
        // 存不了就只是沒有自動打開開關
      }
    } else {
      setReviewFilter(tab);
    }
    router.push("/vocabulary");
  }

  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">我的單字</h1>
        {words.length > 0 ? (
          <Button className="h-9" data-testid="study-all" onClick={studyAll}>
            <GraduationCap data-icon="inline-start" />
            整批去背
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="單字分類">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            data-testid={`tab-${item.key}`}
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? "border-b-2 border-primary px-3 py-1.5 text-sm font-medium text-foreground"
                : "border-b-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <ErrorNotice title="出了狀況" message={error} /> : null}
      {isLoading ? <LoadingBlock label="正在載入" /> : null}

      {!isLoading && words.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">{current.empty}</p>
            <Link
              href="/vocabulary"
              className="inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              去背單字
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && words.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground" data-testid="word-total">
            共 {total} 個
          </p>
          <ul className="space-y-2" data-testid="word-list">
            {words.map((word, position) => (
              <li key={word.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <button
                          type="button"
                          data-testid={`study-${word.id}`}
                          title={`去背 ${word.word}`}
                          className="text-base font-semibold break-words underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          onClick={() => {
                            setStudyWord(word);
                            router.push("/vocabulary");
                          }}
                        >
                          {word.word}
                        </button>
                        {word.phonetic ? (
                          <span className="text-sm text-muted-foreground break-words">
                            [{word.phonetic}]
                          </span>
                        ) : null}
                        {word.pos ? (
                          <span className="text-sm text-muted-foreground">
                            {word.pos}
                          </span>
                        ) : null}
                        <Badge variant="secondary">難度 {word.band}</Badge>
                      </div>
                      <p className="text-sm leading-relaxed break-words">
                        {word.definition_zh ||
                          word.definition_en ||
                          "這個字還沒有釋義資料"}
                      </p>
                    </div>
                    {tab === "bookmark" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-primary"
                        aria-label={`移除 ${word.word} 的書籤`}
                        title="移除書籤"
                        data-testid={`remove-bookmark-${word.id}`}
                        onClick={() => void removeBookmark(word, position)}
                      >
                        <Bookmark className="size-5 fill-current" aria-hidden />
                      </Button>
                    ) : word.bookmarked ? (
                      <Bookmark
                        className="size-5 shrink-0 fill-current text-primary"
                        aria-label="已加入書籤"
                      />
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          {total > words.length ? (
            <p className="text-sm text-muted-foreground">
              只列出最新的 {words.length} 個，還有 {total - words.length} 個沒列出來。
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
