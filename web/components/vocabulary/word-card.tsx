"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Word, WordLevel } from "@/lib/types";

const RATINGS: {
  level: WordLevel;
  label: string;
  className: string;
  testId: string;
}[] = [
  {
    level: "unknown",
    label: "不會",
    className:
      "border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300",
    testId: "rate-unknown",
  },
  {
    level: "fuzzy",
    label: "模糊",
    className:
      "border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300",
    testId: "rate-fuzzy",
  },
  {
    level: "known",
    label: "會了",
    className:
      "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300",
    testId: "rate-known",
  },
];

export function WordCard({
  word,
  index,
  total,
  pending,
  onRate,
}: {
  word: Word;
  index: number;
  total: number;
  pending: boolean;
  onRate: (level: WordLevel) => void;
}) {
  const [flipped, setFlipped] = useState(false);

  const listNames = Object.keys(word.lists ?? {});
  const inflections = word.inflections ?? [];
  const hasDefinition = Boolean(word.definition_zh || word.definition_en);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">難度 {word.band}</Badge>
          <span
            className="text-sm tabular-nums text-muted-foreground"
            data-testid="word-progress"
          >
            {index + 1} / {total}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          data-testid="word-face"
          className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {flipped ? (
            <>
              <span className="text-xl font-bold break-words">{word.word}</span>
              {word.definition_zh ? (
                <span className="text-base leading-relaxed break-words">
                  {word.definition_zh}
                </span>
              ) : null}
              {word.definition_en ? (
                <span className="text-sm leading-relaxed text-muted-foreground break-words">
                  {word.definition_en}
                </span>
              ) : null}
              {hasDefinition ? null : (
                <span className="text-sm text-muted-foreground">
                  這個字還沒有釋義資料
                </span>
              )}
              {inflections.length > 0 ? (
                <span className="text-sm text-muted-foreground break-words">
                  詞形變化：{inflections.join("、")}
                </span>
              ) : null}
              {listNames.length > 0 ? (
                <span className="flex flex-wrap justify-center gap-1.5">
                  {listNames.map((name) => (
                    <Badge key={name} variant="outline">
                      {name}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </>
          ) : (
            <>
              <span className="text-3xl font-bold break-words">{word.word}</span>
              {word.phonetic ? (
                <span className="text-lg text-muted-foreground break-words">
                  [{word.phonetic}]
                </span>
              ) : null}
              {word.pos ? (
                <span className="text-sm text-muted-foreground">{word.pos}</span>
              ) : null}
              <span className="pt-2 text-sm text-muted-foreground">
                點一下翻面看釋義
              </span>
            </>
          )}
        </button>

        <div className="grid grid-cols-3 gap-2" data-testid="rate-row">
          {RATINGS.map((rating) => (
            <Button
              key={rating.level}
              variant="outline"
              size="lg"
              disabled={pending}
              data-testid={rating.testId}
              className={`h-11 w-full ${rating.className}`}
              onClick={() => onRate(rating.level)}
            >
              {rating.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
