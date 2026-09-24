"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNotice, LoadingBlock } from "@/components/status";
import { Highlight, PART_NAMES, QuestionDetail } from "@/components/search/question-detail";
import { errorMessage, searchAll } from "@/lib/api";
import { setStudyWord } from "@/lib/review-handoff";
import type { SearchResult } from "@/lib/types";

// Part 1 語音備妥前聽力頁不露出，搜尋也不帶，免得搜到練不到的題目。
const PART1_READY = process.env.NEXT_PUBLIC_PART1_READY === "1";
const PARTS = PART1_READY ? undefined : ["2", "3", "4", "5", "6", "7"];

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingBlock label="載入中" />}>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const router = useRouter();
  const query = (useSearchParams().get("q") ?? "").trim();
  const [draft, setDraft] = useState(query);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // 網址上的查詢字是唯一來源：上一頁、導覽列送出都會改網址，這裡跟著重查。
  useEffect(() => {
    queueMicrotask(() => {
      setDraft(query);
      setOpen(null);
    });
    if (!query) {
      queueMicrotask(() => setResult(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setError("");
    });
    searchAll(query, PARTS)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e, "搜尋失敗"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draft.trim();
    if (next && next !== query) router.push(`/search?q=${encodeURIComponent(next)}`);
  }

  const empty = result && result.words.length === 0 && result.questions.length === 0;

  return (
    <div className="space-y-6">
      <form role="search" onSubmit={submit} className="flex items-center gap-2 border-b border-foreground pb-1">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={40}
          autoFocus={!query}
          enterKeyHint="search"
          placeholder="英文單字或中文解釋"
          aria-label="搜尋單字與題目"
          data-testid="search-page-input"
          className="min-w-0 flex-1 bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground"
        />
      </form>

      {isLoading ? <LoadingBlock label="搜尋中" /> : null}
      {error ? <ErrorNotice message={error} /> : null}

      {!isLoading && empty ? (
        <p className="text-muted-foreground" data-testid="search-empty">
          找不到「{result.query}」
        </p>
      ) : null}

      {!isLoading && result && result.words.length > 0 ? (
        <section className="space-y-2" aria-labelledby="search-words">
          <h2 id="search-words" className="text-sm text-muted-foreground">
            單字 {result.words.length}
          </h2>
          <ul className="divide-y divide-border border-y border-border" data-testid="search-words">
            {result.words.map((word) => (
              <li key={word.id}>
                <button
                  type="button"
                  data-testid={`search-word-${word.id}`}
                  title={`去背 ${word.word}`}
                  className="flex w-full items-start gap-3 px-1 py-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  onClick={() => {
                    setStudyWord(word);
                    router.push("/vocabulary");
                  }}
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="text-base font-semibold break-words">{word.word}</span>
                      {word.pos ? <span className="text-sm text-muted-foreground">{word.pos}</span> : null}
                      <Badge variant="secondary">難度 {word.band}</Badge>
                    </span>
                    <span className="block text-sm leading-relaxed break-words">
                      <Highlight
                        text={word.definition_zh || word.definition_en || "這個字還沒有釋義資料"}
                        terms={/\p{Script=Han}/u.test(result.query) ? [result.query] : []}
                      />
                    </span>
                  </span>
                  {word.bookmarked ? (
                    <Bookmark className="mt-1 size-4 shrink-0 fill-current text-primary" aria-label="已加入書籤" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isLoading && result && result.questions.length > 0 ? (
        <section className="space-y-2" aria-labelledby="search-questions">
          <h2 id="search-questions" className="text-sm text-muted-foreground">
            題目 {result.question_total}
            {result.question_total > result.questions.length
              ? `（列出 ${result.questions.length} 題）`
              : ""}
          </h2>
          <ul className="space-y-2" data-testid="search-questions">
            {result.questions.map((hit) => {
              const expanded = open === hit.id;
              return (
                <li key={hit.id}>
                  <Card>
                    <CardContent className="space-y-3 py-3">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        data-testid={`search-question-${hit.id}`}
                        className="flex w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() => setOpen(expanded ? null : hit.id)}
                      >
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block text-xs text-muted-foreground">{PART_NAMES[hit.part] ?? `Part ${hit.part}`}</span>
                          <span className="block text-sm leading-relaxed break-words">
                            <Highlight text={hit.snippet} terms={result.terms} />
                          </span>
                        </span>
                        <ChevronDown
                          className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                      {expanded ? (
                        <div className="border-t border-border pt-3" data-testid={`search-detail-${hit.id}`}>
                          <QuestionDetail part={hit.part} payload={hit.payload} terms={result.terms} />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
