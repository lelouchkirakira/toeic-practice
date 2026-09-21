"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_ACCENT, type AccentId } from "@/hooks/use-speech";
import { WordCard } from "@/components/vocabulary/word-card";
import { ErrorNotice, InfoNotice, LoadingBlock } from "@/components/status";
import { errorMessage, fetchWords, saveWordProgress } from "@/lib/api";
import type { Word, WordLevel } from "@/lib/types";

// Select 不接受空字串當值，「全部」用哨兵值表示，送出前轉回空字串
const ALL = "all";

const LIST_OPTIONS = [
  { value: ALL, label: "全部字表" },
  { value: "TSL", label: "TSL 多益字" },
  { value: "BSL", label: "BSL 商業字" },
  { value: "NAWL", label: "NAWL 學術字" },
  { value: "NGSL-GR", label: "NGSL-GR 核心字" },
];

const BAND_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const LEVEL_OPTIONS = [
  { value: ALL, label: "全部" },
  { value: "new", label: "未學" },
  { value: "learning", label: "學習中" },
  { value: "known", label: "已熟" },
];

const COUNT_OPTIONS = [20, 40, 60];

export default function VocabularyPage() {
  const [list, setList] = useState(ALL);
  const [bandMin, setBandMin] = useState(1);
  const [bandMax, setBandMax] = useState(12);
  const [level, setLevel] = useState(ALL);
  const [count, setCount] = useState(20);

  const [words, setWords] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [accent, setAccent] = useState<AccentId>(DEFAULT_ACCENT);

  // 自動發音的偏好記在這台裝置上。讀取可能因為隱私模式而失敗，失敗就用預設值。
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("toeic:auto-speak");
      if (saved !== null) setAutoSpeak(saved === "1");
      const savedAccent = window.localStorage.getItem("toeic:accent");
      if (savedAccent === "us" || savedAccent === "gb" || savedAccent === "au") {
        setAccent(savedAccent);
      }
    } catch {
      // 讀不到就維持預設
    }
  }, []);

  const changeAccent = useCallback((next: AccentId) => {
    setAccent(next);
    try {
      window.localStorage.setItem("toeic:accent", next);
    } catch {
      // 存不了就只在這次瀏覽有效
    }
  }, []);

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak((value) => {
      const next = !value;
      try {
        window.localStorage.setItem("toeic:auto-speak", next ? "1" : "0");
      } catch {
        // 存不了就只在這次瀏覽有效
      }
      return next;
    });
  }, []);

  // 篩選條件在輸入時不該觸發重抽，抽卡時才讀取當下的值
  const filterRef = useRef({ list, bandMin, bandMax, level, count });
  filterRef.current = { list, bandMin, bandMax, level, count };

  const load = useCallback(async () => {
    const filter = filterRef.current;
    const min = Math.min(filter.bandMin, filter.bandMax);
    const max = Math.max(filter.bandMin, filter.bandMax);

    setIsLoading(true);
    setError("");
    setWords([]);
    setIndex(0);
    try {
      const data = await fetchWords({
        list: filter.list === ALL ? "" : filter.list,
        bandMin: min,
        bandMax: max,
        level: filter.level === ALL ? "" : filter.level,
        count: filter.count,
      });
      setWords(data);
    } catch (e) {
      setError(errorMessage(e, "載入單字失敗"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function rate(wordId: string, wordLevel: WordLevel) {
    setIsSaving(true);
    setError("");
    try {
      await saveWordProgress(wordId, wordLevel);
      setIndex((value) => value + 1);
    } catch (e) {
      setError(errorMessage(e, "熟練度寫入失敗"));
    } finally {
      setIsSaving(false);
    }
  }

  const currentWord = words[index];
  const isFinished = words.length > 0 && index >= words.length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">背單字</h1>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="list-select">字表</Label>
              <Select value={list} onValueChange={setList}>
                <SelectTrigger id="list-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="band-min-select">難度起</Label>
              <Select
                value={String(bandMin)}
                onValueChange={(value) => setBandMin(Number(value))}
              >
                <SelectTrigger id="band-min-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BAND_OPTIONS.map((band) => (
                    <SelectItem key={band} value={String(band)}>
                      第 {band} 級
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="band-max-select">難度迄</Label>
              <Select
                value={String(bandMax)}
                onValueChange={(value) => setBandMax(Number(value))}
              >
                <SelectTrigger id="band-max-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BAND_OPTIONS.map((band) => (
                    <SelectItem key={band} value={String(band)}>
                      第 {band} 級
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level-select">熟練度</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="level-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="count-select">張數</Label>
              <Select
                value={String(count)}
                onValueChange={(value) => setCount(Number(value))}
              >
                <SelectTrigger id="count-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNT_OPTIONS.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} 張
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                className="h-9 flex-1"
                data-testid="reload-words"
                onClick={() => void load()}
              >
                <RefreshCw data-icon="inline-start" />
                重新抽卡
              </Button>
              <Button
                variant={autoSpeak ? "secondary" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-pressed={autoSpeak}
                aria-label={autoSpeak ? "關閉自動發音" : "開啟自動發音"}
                title={autoSpeak ? "自動發音：開" : "自動發音：關"}
                data-testid="toggle-auto-speak"
                onClick={toggleAutoSpeak}
              >
                {autoSpeak ? (
                  <Volume2 className="size-4" aria-hidden />
                ) : (
                  <VolumeX className="size-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorNotice title="出了狀況" message={error} /> : null}

      {isLoading ? <LoadingBlock label="正在抽卡" /> : null}

      {!isLoading && words.length === 0 ? (
        <InfoNotice message="沒有符合條件的單字，換個篩選條件再試一次。" />
      ) : null}

      {!isLoading && isFinished ? (
        <Card>
          <CardContent className="space-y-4 text-center">
            <p className="text-lg font-semibold">
              這一輪 {words.length} 張看完了
            </p>
            <Button className="h-11 w-full" onClick={() => void load()}>
              <RefreshCw data-icon="inline-start" />
              再抽一輪
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && currentWord ? (
        <WordCard
          key={currentWord.id}
          word={currentWord}
          index={index}
          total={words.length}
          pending={isSaving}
          autoSpeak={autoSpeak}
          accent={accent}
          onAccentChange={changeAccent}
          onRate={(wordLevel) => void rate(currentWord.id, wordLevel)}
        />
      ) : null}
    </div>
  );
}
