"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Loader2, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ErrorNotice } from "@/components/status";
import {
  errorMessage,
  fetchListeningQuestions,
  fetchListeningReview,
  submitAnswers,
} from "@/lib/api";
import type { ListeningQuestion, ListeningReview } from "@/lib/types";
import {
  originalLabel,
  playPart2,
  shuffledOrder,
  type SequenceHandle,
} from "@/lib/part2-sequence";

const QUESTION_COUNT = 10;
const LETTERS_KEY = "toeic:part2-letters";

// A、B、C 對應的是聽到的三個回答的順序，畫面上要講明白，
// 不然只看到三顆字母會不知道在選什麼。
const ORDINALS = ["第一個", "第二個", "第三個"];

type Phase = "loading" | "ready" | "playing" | "answering" | "done" | "finished";

interface Answer {
  questionId: string;
  /** 換算回原題目的選項字母，拿來對答案 */
  picked: string;
  /** 畫面上按的是第幾個位置（0 起算），檢討時照播放順序顯示 */
  slot: number;
}

export function Part2Runner() {
  const [questions, setQuestions] = useState<ListeningQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reviews, setReviews] = useState<ListeningReview[]>([]);
  const [error, setError] = useState("");
  const [audioIssue, setAudioIssue] = useState<"" | "load" | "blocked">("");
  const sequenceRef = useRef<SequenceHandle | null>(null);
  // 每題的回答播放順序，出題時決定，檢討時照同一個順序顯示。
  const [orders, setOrders] = useState<Record<string, number[]>>({});
  // 練習時唸出 A B C，關掉就只播回答本身。記在這台裝置上。
  const [withLetters, setWithLetters] = useState(true);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  const load = useCallback(async () => {
    setPhase("loading");
    setError("");
    setAnswers([]);
    setReviews([]);
    setIndex(0);
    try {
      const data = await fetchListeningQuestions(QUESTION_COUNT);
      if (data.questions.length === 0) {
        setError("題庫裡沒有聽力題");
        return;
      }
      setQuestions(data.questions);
      setOrders(Object.fromEntries(data.questions.map((q) => [q.id, shuffledOrder()])));
      setPhase("ready");
    } catch (e) {
      setError(errorMessage(e, "載入題目失敗"));
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      sequenceRef.current?.stop();
      sequenceRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LETTERS_KEY);
      // React 19 的 react-hooks/set-state-in-effect：包 microtask 避免 cascading render
      if (saved !== null) queueMicrotask(() => setWithLetters(saved === "1"));
    } catch {
      // 讀不到就維持預設的唸字母
    }
  }, []);

  const toggleLetters = useCallback(() => {
    setWithLetters((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(LETTERS_KEY, next ? "1" : "0");
      } catch {
        // 存不了就只在這次有效
      }
      return next;
    });
  }, []);

  // 一題只播一次，跟實際考試一樣，播完就要作答。
  const play = useCallback(() => {
    if (!current) return;
    const order = orders[current.id] ?? [1, 2, 3];
    setAudioIssue("");
    setPhase("playing");

    // 換下一段之前先停掉上一段，不然舊的播放會被打斷、丟出看起來像故障的錯誤。
    sequenceRef.current?.stop();
    sequenceRef.current = playPart2(current.id, order, withLetters, {
      onEnd: () => setPhase("answering"),
      // 載不到就退回可重播的狀態。網路斷一下就把這題判死、逼人盲猜是不對的。
      onError: (reason) => {
        setAudioIssue(reason);
        setPhase("ready");
      },
    });
  }, [current, orders, withLetters]);

  const pick = useCallback(
    (slot: number) => {
      if (!current) return;
      const order = orders[current.id] ?? [1, 2, 3];
      setAnswers((prev) => [
        ...prev,
        { questionId: current.id, picked: originalLabel(order, slot), slot },
      ]);
      setPhase("done");
    },
    [current, orders],
  );

  const next = useCallback(async () => {
    if (!isLast) {
      setIndex((value) => value + 1);
      setAudioIssue("");
      setPhase("ready");
      return;
    }

    setPhase("loading");
    try {
      const data = await fetchListeningReview(questions.map((q) => q.id));
      const byId = new Map(data.questions.map((q) => [q.id, q]));
      const ordered = questions
        .map((q) => byId.get(q.id))
        .filter((q): q is ListeningReview => Boolean(q));
      setReviews(ordered);

      const graded = answers.map((answer) => {
        const review = byId.get(answer.questionId);
        return {
          question_id: answer.questionId,
          part: "2",
          user_answer: answer.picked,
          correct_answer: review?.answer ?? "",
          is_correct: review?.answer === answer.picked,
        };
      });
      await submitAnswers({
        mode: "practice",
        part: "2",
        answers: graded,
        time_spent_seconds: 0,
      });
      setPhase("finished");
    } catch (e) {
      setError(errorMessage(e, "取得檢討內容失敗"));
      setPhase("finished");
    }
  }, [answers, isLast, questions]);

  if (error && phase !== "finished") {
    return (
      <div className="space-y-4">
        <ErrorNotice title="出了狀況" message={error} />
        <Button onClick={() => void load()}>重新載入</Button>
      </div>
    );
  }

  if (phase === "finished") {
    const correct = reviews.filter(
      (review, i) => review.answer === answers[i]?.picked,
    ).length;
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold tabular-nums">
              {correct} / {reviews.length}
            </p>
            <p className="text-sm text-muted-foreground">
              答對 {reviews.length > 0 ? Math.round((correct / reviews.length) * 100) : 0}%
            </p>
            <Button className="mt-2" onClick={() => void load()}>
              <RotateCcw data-icon="inline-start" />
              再來一輪
            </Button>
          </CardContent>
        </Card>

        {reviews.map((review, i) => {
          const picked = answers[i]?.picked;
          const right = review.answer === picked;
          return (
            <Card key={review.id}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={right ? "secondary" : "destructive"}>
                    第 {i + 1} 題 {right ? "答對" : "答錯"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      sequenceRef.current?.stop();
                      sequenceRef.current = playPart2(
                        review.id,
                        orders[review.id] ?? [1, 2, 3],
                        withLetters,
                        { onEnd: () => undefined, onError: () => undefined },
                      );
                    }}
                  >
                    <Play data-icon="inline-start" />
                    重聽
                  </Button>
                </div>
                <p className="font-medium">{review.prompt}</p>
                <ul className="space-y-1 text-sm">
                  {(orders[review.id] ?? [1, 2, 3]).map((response, slot) => {
                    // 照這一輪實際播出的順序列，字母也是當時唸的那個。
                    const option = review.options[response - 1];
                    if (!option) return null;
                    const shown = "ABC"[slot];
                    return (
                      <li
                        key={option.label}
                        className={
                          option.label === review.answer
                            ? "font-semibold text-foreground"
                            : option.label === picked
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
                      >
                        {shown}. {option.text}
                        {option.label === review.answer ? "（正解）" : null}
                        {option.label === picked && !right ? "（你選的）" : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm text-muted-foreground">{review.explanation}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm tabular-nums text-muted-foreground" data-testid="listening-progress">
          第 {Math.min(index + 1, questions.length)} 題 / 共 {questions.length} 題
        </span>
      </div>

      <Progress value={questions.length ? (index / questions.length) * 100 : 0} />

      <p className="text-sm text-muted-foreground">
        應答問題：你會聽到一個問句，接著是三個回答。題目與選項都不會顯示在畫面上，
        聽完後選出最適合的那個回答。每題只播一次，三個回答的順序每次都會打亂。
      </p>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={withLetters}
          onChange={toggleLetters}
          disabled={phase === "playing"}
          data-testid="toggle-letters"
          className="size-4 accent-primary"
        />
        回答前唸出 A B C
        <span className="text-xs">（正式考試不唸，想模擬真實情境就關掉）</span>
      </label>

      <Card>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-4xl font-bold tabular-nums" data-testid="listening-big-number">
              {Math.min(index + 1, questions.length)}
              <span className="text-xl font-normal text-muted-foreground">
                {" "}
                / {questions.length}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">題號</p>
          </div>

          <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            {phase === "loading" ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
                <span className="text-sm text-muted-foreground">載入中</span>
              </>
            ) : phase === "playing" ? (
              <>
                <span className="listening-wave flex items-end gap-1.5" aria-hidden>
                  {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                    <span
                      key={bar}
                      style={{
                        animationDelay: `${bar * 0.12}s`,
                        height: `${[16, 28, 40, 48, 40, 28, 16][bar]}px`,
                      }}
                    />
                  ))}
                </span>
                <span className="text-sm text-muted-foreground" data-testid="listening-state">
                  播放中，仔細聽
                </span>
              </>
            ) : phase === "ready" ? (
              <>
                <Button size="lg" onClick={play} data-testid="listening-play">
                  <Play data-icon="inline-start" />
                  {audioIssue === "load" ? "重新播放" : "開始播放"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {audioIssue === "blocked"
                    ? "瀏覽器擋下了播放，再點一次"
                    : audioIssue === "load"
                      ? "音檔載入失敗，再點一次重試"
                      : "只播一次，聽完再作答"}
                </span>
                {audioIssue === "load" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="listening-skip-audio"
                    onClick={() => setPhase("answering")}
                  >
                    不聽了，直接作答
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Headphones className="size-8 text-muted-foreground" aria-hidden />
                <span className="text-sm text-muted-foreground" data-testid="listening-state">
                  {audioIssue === "load"
                    ? "沒有聽到音檔，直接選一個"
                    : "播放結束，選一個最適合的回答"}
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2" data-testid="listening-options">
            {["A", "B", "C"].map((label, i) => (
              <Button
                key={label}
                variant="outline"
                size="lg"
                aria-pressed={answers[index]?.slot === i}
                className={`flex h-auto w-full flex-col gap-0.5 py-2.5 ${
                  answers[index]?.slot === i
                    ? "border-2 border-primary bg-primary/10"
                    : ""
                }`}
                disabled={phase !== "answering"}
                data-testid={`listening-option-${label}`}
                onClick={() => pick(i)}
              >
                <span className="text-base font-semibold">{label}</span>
                <span className="text-xs font-normal opacity-70">
                  {ORDINALS[i] ?? `第 ${i + 1} 個`}回答
                </span>
              </Button>
            ))}
          </div>

          {phase === "done" ? (
            <Button className="w-full" onClick={() => void next()} data-testid="listening-next">
              {isLast ? "看結果" : "下一題"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
