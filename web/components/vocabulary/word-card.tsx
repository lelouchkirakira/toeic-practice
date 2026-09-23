"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACCENTS,
  EXAMPLE_AUDIO_READY,
  GENDERS,
  MALE_READY,
  audioUrlFor,
  exampleAudioUrlFor,
  useSpeech,
} from "@/hooks/use-speech";
import type { AccentId, GenderId } from "@/hooks/use-speech";
import { lookupTokens } from "@/lib/api";
import { ExampleSentence, collectTokens } from "./example-sentence";
import { WordPopover, type PopoverAnchor } from "./word-popover";
import type { LookupEntries, Word, WordLevel } from "@/lib/types";

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
      "border-[var(--tone-poor)] text-[var(--tone-poor)] hover:bg-[var(--tone-poor-soft)]",
    testId: "rate-unknown",
  },
  {
    level: "fuzzy",
    label: "模糊",
    className:
      "border-[var(--tone-fair)] text-[var(--tone-fair)] hover:bg-[var(--tone-fair-soft)]",
    testId: "rate-fuzzy",
  },
  {
    level: "known",
    label: "會了",
    className:
      "border-[var(--tone-good)] text-[var(--tone-good)] hover:bg-[var(--tone-good-soft)]",
    testId: "rate-known",
  },
];


export function WordCard({
  word,
  index,
  total,
  pending,
  autoSpeak,
  accent,
  gender,
  onAccentChange,
  onGenderChange,
  onRate,
  onToggleBookmark,
}: {
  word: Word;
  index: number;
  total: number;
  pending: boolean;
  autoSpeak: boolean;
  accent: AccentId;
  gender: GenderId;
  onAccentChange: (accent: AccentId) => void;
  onGenderChange: (gender: GenderId) => void;
  onRate: (level: WordLevel) => void;
  onToggleBookmark: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  // 單字與例句共用一個播放器，記住這次唸的是誰，播放中的顏色才不會亮在別顆按鈕上。
  const [source, setSource] = useState<"word" | number>("word");
  const { supported, speaking, speak } = useSpeech();
  const audioUrl = audioUrlFor(word.id, accent, gender);
  const spokenIdRef = useRef("");

  // 換到新的字時自動唸一次。翻面狀態也要跟著重置，不然會看到上一張的背面。
  // 只認 word.id：切口音或切男女聲也會換掉 audioUrl，但那時按鈕自己已經播了
  // 一次，這裡再播一次就是同一個字唸兩次。
  useEffect(() => {
    if (spokenIdRef.current === word.id) return;
    spokenIdRef.current = word.id;
    setFlipped(false);
    setSource("word");
    if (autoSpeak && supported) speak(word.word, audioUrl);
  }, [word.id, word.word, audioUrl, autoSpeak, supported, speak]);

  const bookmarked = word.bookmarked ?? false;
  // 例句點字：查得到的字才做成按鈕。翻面看到例句時查一次，同一張卡翻來翻去不重查。
  const [entries, setEntries] = useState<LookupEntries>({});
  const [picked, setPicked] = useState<{ word: Word; anchor: PopoverAnchor | null } | null>(null);
  const [hoverCapable, setHoverCapable] = useState(false);
  const lookedUpRef = useRef("");
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    queueMicrotask(() => setHoverCapable(query.matches));
  }, []);

  useEffect(() => {
    if (!flipped || lookedUpRef.current === word.id) return;
    const tokens = collectTokens((word.examples ?? []).map((e) => e.en));
    if (tokens.length === 0) return;
    lookedUpRef.current = word.id;
    lookupTokens(tokens)
      .then(setEntries)
      // 查不到就讓例句維持純文字，不要把整塊例句弄不見
      .catch(() => setEntries({}));
  }, [flipped, word.id, word.examples]);

  useEffect(() => {
    return () => {
      if (openTimer.current) window.clearTimeout(openTimer.current);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  // 滑鼠掃過整句時不要一路開好幾張，停留 150 毫秒才開。點擊則立刻開。
  const pick = useCallback(
    (target: Word, anchor: PopoverAnchor | null, hover: boolean) => {
      clearTimers();
      if (!hover) {
        setPicked({ word: target, anchor });
        return;
      }
      openTimer.current = window.setTimeout(() => {
        setPicked({ word: target, anchor });
      }, 150);
    },
    [clearTimers],
  );

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setPicked(null), 120);
  }, [clearTimers]);

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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`播放 ${word.word} 的發音`}
                data-testid="speak-word"
                className={speaking && source === "word" ? "text-primary" : undefined}
                onClick={() => {
                  setSource("word");
                  speak(word.word, audioUrl);
                }}
              >
                <Volume2 className="size-5" aria-hidden />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={bookmarked}
              aria-label={bookmarked ? "移除書籤" : "加入書籤"}
              title={bookmarked ? "移除書籤" : "加入書籤"}
              data-testid="toggle-bookmark"
              className={bookmarked ? "text-primary" : undefined}
              onClick={onToggleBookmark}
            >
              <Bookmark
                className={`size-5${bookmarked ? " fill-current" : ""}`}
                aria-hidden
              />
            </Button>
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

        {flipped && examples.length > 0 ? (
          <div
            className="space-y-3 rounded-xl border border-border bg-muted/20 p-3"
            data-testid="example-list"
          >
            {examples.map((example, index) => {
              const number = index + 1;
              const sentence = example.en.replace(/\*\*/g, "");
              return (
                <div key={index} className="flex items-start gap-2">
                  {EXAMPLE_AUDIO_READY && supported ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`播放第 ${number} 句例句`}
                      data-testid={`speak-example-${number}`}
                      className={`size-7 shrink-0 ${
                        speaking && source === number ? "text-primary" : ""
                      }`}
                      onClick={() => {
                        setSource(number);
                        speak(sentence, exampleAudioUrlFor(word.id, number));
                      }}
                    >
                      <Volume2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                  <div className="space-y-0.5 text-left">
                    <ExampleSentence
                      sentence={example.en}
                      entries={entries}
                      onPick={pick}
                      onLeave={scheduleClose}
                    />
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {example.zh}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {picked ? (
          <WordPopover
            word={picked.word}
            anchor={picked.anchor}
            hoverCapable={hoverCapable}
            canSpeak={supported}
            onSpeak={() => {
              setSource("word");
              speak(picked.word.word, audioUrlFor(picked.word.id, accent, gender));
            }}
            onClose={() => {
              clearTimers();
              setPicked(null);
            }}
            onPointerEnter={clearTimers}
            onPointerLeave={scheduleClose}
          />
        ) : null}

        {supported && ACCENTS.length > 1 ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-muted-foreground">口音</span>
              <div className="flex flex-1 overflow-hidden rounded-md border" role="group" aria-label="發音口音">
                {ACCENTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.title}
                    aria-pressed={accent === option.id}
                    data-testid={`accent-${option.id}`}
                    className={`flex-1 py-1.5 transition-colors ${
                      accent === option.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      onAccentChange(option.id);
                      setSource("word");
                      speak(word.word, audioUrlFor(word.id, option.id, gender));
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {MALE_READY ? (
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-muted-foreground">聲音</span>
                <div className="flex flex-1 overflow-hidden rounded-md border" role="group" aria-label="發音性別">
                  {GENDERS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      title={option.title}
                      aria-pressed={gender === option.id}
                      data-testid={`gender-${option.id}`}
                      className={`flex-1 py-1.5 transition-colors ${
                        gender === option.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={() => {
                        onGenderChange(option.id);
                        setSource("word");
                        speak(word.word, audioUrlFor(word.id, accent, option.id));
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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
