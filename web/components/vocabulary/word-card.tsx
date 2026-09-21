"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ACCENTS, audioUrlFor, useSpeech } from "@/hooks/use-speech";
import type { AccentId } from "@/hooks/use-speech";
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


/** 把例句裡的 **目標單字** 轉成粗體。 */
function renderExample(sentence: string) {
  return sentence.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function WordCard({
  word,
  index,
  total,
  pending,
  autoSpeak,
  accent,
  onAccentChange,
  onRate,
}: {
  word: Word;
  index: number;
  total: number;
  pending: boolean;
  autoSpeak: boolean;
  accent: AccentId;
  onAccentChange: (accent: AccentId) => void;
  onRate: (level: WordLevel) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const { supported, speaking, speak } = useSpeech();
  const audioUrl = audioUrlFor(word.id, accent);

  // 換到新的字時自動唸一次。翻面狀態也要跟著重置，不然會看到上一張的背面。
  useEffect(() => {
    setFlipped(false);
    if (autoSpeak && supported) speak(word.word, audioUrl);
  }, [word.id, word.word, audioUrl, autoSpeak, supported, speak]);

  const listNames = Object.keys(word.lists ?? {});
  const inflections = word.inflections ?? [];
  const examples = word.examples ?? [];
  const hasDefinition = Boolean(word.definition_zh || word.definition_en);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">難度 {word.band}</Badge>
          <div className="flex items-center gap-1.5">
            {supported ? (
              <div className="flex overflow-hidden rounded-md border" role="group" aria-label="發音口音">
                {ACCENTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.title}
                    aria-pressed={accent === option.id}
                    data-testid={`accent-${option.id}`}
                    className={`px-2 py-1 text-xs transition-colors ${
                      accent === option.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      onAccentChange(option.id);
                      speak(word.word, audioUrlFor(word.id, option.id));
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            {supported ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`播放 ${word.word} 的發音`}
                data-testid="speak-word"
                className={speaking ? "text-primary" : undefined}
                onClick={() => speak(word.word, audioUrl)}
              >
                <Volume2 className="size-5" aria-hidden />
              </Button>
            ) : null}
            <span
              className="text-sm tabular-nums text-muted-foreground"
              data-testid="word-progress"
            >
              {index + 1} / {total}
            </span>
          </div>
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
              {examples.length > 0 ? (
                <span className="w-full space-y-2 border-t pt-3 text-left">
                  {examples.map((example, index) => (
                    <span key={index} className="block">
                      <span className="block text-sm leading-relaxed">
                        {renderExample(example.en)}
                      </span>
                      <span className="block text-sm leading-relaxed text-muted-foreground">
                        {example.zh}
                      </span>
                    </span>
                  ))}
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
