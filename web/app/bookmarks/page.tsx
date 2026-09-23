"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNotice, LoadingBlock } from "@/components/status";
import { errorMessage, fetchBookmarks, saveBookmark } from "@/lib/api";
import { REVIEW_FLAG } from "@/lib/review-handoff";
import type { Word } from "@/lib/types";

const LIST_LIMIT = 200;

export default function BookmarksPage() {
  const router = useRouter();
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchBookmarks(LIST_LIMIT);
      setWords(data.words);
      setTotal(data.total);
    } catch (e) {
      setError(errorMessage(e, "載入書籤失敗"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // React 19 的 react-hooks/set-state-in-effect：包 microtask 避免 cascading render
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  // 先從畫面上移掉再送請求，失敗就放回原位。
  async function remove(word: Word, position: number) {
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

  // 背單字頁讀到這個旗標就直接以只抽書籤的條件載入，讀完自己清掉。
  function startReview() {
    try {
      window.sessionStorage.setItem(REVIEW_FLAG, "1");
    } catch {
      // 存不了就只是沒有自動打開開關，頁面照常能用
    }
    router.push("/vocabulary");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">書籤</h1>
        {words.length > 0 ? (
          <Button
            className="h-9"
            data-testid="start-review"
            onClick={startReview}
          >
            <GraduationCap data-icon="inline-start" />
            用書籤複習
          </Button>
        ) : null}
      </div>

      {error ? <ErrorNotice title="出了狀況" message={error} /> : null}

      {isLoading ? <LoadingBlock label="正在載入書籤" /> : null}

      {!isLoading && words.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">
              還沒有標記任何單字。到背單字頁，在卡片右上角點書籤就會收進來。
            </p>
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
          <p className="text-sm text-muted-foreground" data-testid="bookmark-total">
            共 {total} 個
          </p>
          <ul className="space-y-2" data-testid="bookmark-list">
            {words.map((word, position) => (
              <li key={word.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-semibold break-words">
                          {word.word}
                        </span>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-primary"
                      aria-label={`移除 ${word.word} 的書籤`}
                      title="移除書籤"
                      data-testid={`remove-bookmark-${word.id}`}
                      onClick={() => void remove(word, position)}
                    >
                      <Bookmark className="size-5 fill-current" aria-hidden />
                    </Button>
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
