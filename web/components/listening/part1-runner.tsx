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
  fetchPhotoQuestions,
  fetchPhotoReview,
  submitAnswers,
} from "@/lib/api";
import {
  originalLabel,
  playPart1,
  shuffledOrder,
  type SequenceHandle,
} from "@/lib/part2-sequence";
import type { PhotoQuestion, PhotoReview } from "@/lib/types";

const QUESTION_COUNT = 6;
const LABELS = ["A", "B", "C", "D"];

type Phase = "loading" | "ready" | "playing" | "answering" | "done" | "finished";

interface Answer {
  questionId: string;
  picked: string;
  slot: number;
}

/* Part 1 看圖：看一張照片，聽四句描述，選最符合照片的那句。
 * 跟 Part 2 一樣，四句的播放順序每輪打亂，每句前面唸字母。 */
export function Part1Runner() {
  const [questions, setQuestions] = useState<PhotoQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reviews, setReviews] = useState<PhotoReview[]>([]);
  const [orders, setOrders] = useState<Record<string, number[]>>({});
  const [error, setError] = useState("");
  const [audioIssue, setAudioIssue] = useState<"" | "load" | "blocked">("");
  const sequenceRef = useRef<SequenceHandle | null>(null);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  const load = useCallback(async () => {
    setPhase("loading");
    setError("");
    setAnswers([]);
    setReviews([]);
    setIndex(0);
    try {
      const data = await fetchPhotoQuestions(QUESTION_COUNT);
      if (data.questions.length === 0) {
        setError("題庫裡沒有 Part 1 的題目");
        return;
      }
      setQuestions(data.questions);
      setOrders(Object.fromEntries(data.questions.map((q) => [q.id, shuffledOrder(4)])));
      setPhase("ready");
    } catch (e) {
      setError(errorMessage(e, "載入題目失敗"));
    }
  }, []);

  useEffect(() => {
    // React 19 的 react-hooks/set-state-in-effect：包 microtask 避免 cascading render
    queueMicrotask(() => void load());
    return () => {
      sequenceRef.current?.stop();
      sequenceRef.current = null;
    };
  }, [load]);

  const play = useCallback(() => {
    if (!current) return;
    setAudioIssue("");
    setPhase("playing");
    sequenceRef.current?.stop();
    sequenceRef.current = playPart1(current.id, orders[current.id] ?? [1, 2, 3, 4], {
      onEnd: () => setPhase("answering"),
      onError: (reason) => {
        setAudioIssue(reason);
        setPhase("ready");
      },
    });
  }, [current, orders]);

  const pick = useCallback(
    (slot: number) => {
      if (!current) return;
      const order = orders[current.id] ?? [1, 2, 3, 4];
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
      const data = await fetchPhotoReview(questions.map((q) => q.id));
      const byId = new Map(data.questions.map((q) => [q.id, q]));
      setReviews(
        questions.map((q) => byId.get(q.id)).filter((q): q is PhotoReview => Boolean(q)),
      );
      await submitAnswers({
        mode: "practice",
        part: "1",
        answers: answers.map((answer) => {
          const review = byId.get(answer.questionId);
          return {
            question_id: answer.questionId,
            part: "1",
            user_answer: answer.picked,
            correct_answer: review?.answer ?? "",
            is_correct: review?.answer === answer.picked,
          };
        }),
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
    const correct = reviews.filter((r, i) => r.answer === answers[i]?.picked).length;
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold tabular-nums">
              {correct} / {reviews.length}
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
          const order = orders[review.id] ?? [1, 2, 3, 4];
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
                      sequenceRef.current = playPart1(review.id, order, {
                        onEnd: () => undefined,
                        onError: () => undefined,
                      });
                    }}
                  >
                    <Play data-icon="inline-start" />
                    重聽
                  </Button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/${review.photo}`}
                  alt="題目照片"
                  className="w-full border border-border"
                  loading="lazy"
                />
                <ul className="space-y-1 text-sm" data-testid="photo-review">
                  {order.map((statement, slot) => {
                    const item = review.statements[statement - 1];
                    if (!item) return null;
                    return (
                      <li
                        key={item.label}
                        className={
                          item.label === review.answer
                            ? "font-semibold text-foreground"
                            : item.label === picked
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
                      >
                        {LABELS[slot]}. {item.text}
                        {item.label === review.answer ? "（正解）" : null}
                        {item.label === picked && !right ? "（你選的）" : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm text-muted-foreground">{review.explanation}</p>
                <p className="text-xs text-muted-foreground">
                  照片：{review.credit.creator !== "unknown" ? `${review.credit.creator}，` : ""}
                  <a href={review.credit.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                    {review.credit.source}
                  </a>
                  ，CC0
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <span className="text-sm tabular-nums text-muted-foreground" data-testid="photo-progress">
        第 {Math.min(index + 1, questions.length)} 題 / 共 {questions.length} 題
      </span>
      <Progress value={questions.length ? (index / questions.length) * 100 : 0} />
      <p className="text-sm text-muted-foreground">
        看照片，聽四句描述，選出最符合照片的那一句。描述不會顯示在畫面上，每題只播一次。
      </p>

      <Card>
        <CardContent className="space-y-4">
          {current ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/${current.photo}`}
                alt="題目照片"
                className="w-full border border-border"
                data-testid="photo"
              />
            </>
          ) : null}

          <div className="flex flex-col items-center gap-2 py-2">
            {phase === "loading" ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            ) : phase === "ready" ? (
              <>
                <Button size="lg" onClick={play} data-testid="photo-play">
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
                  <Button variant="outline" size="sm" onClick={() => setPhase("answering")}>
                    不聽了，直接作答
                  </Button>
                ) : null}
              </>
            ) : phase === "playing" ? (
              <span className="text-sm text-muted-foreground" data-testid="photo-state">
                播放中，仔細聽
              </span>
            ) : (
              <span className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="photo-state">
                <Headphones className="size-5" aria-hidden />
                {audioIssue === "load" ? "沒有聽到音檔，直接選一個" : "播放結束，選最符合照片的描述"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2" data-testid="photo-options">
            {LABELS.map((label, i) => (
              <Button
                key={label}
                variant="outline"
                size="lg"
                aria-pressed={answers[index]?.slot === i}
                className={answers[index]?.slot === i ? "border-2 border-primary bg-primary/10" : ""}
                disabled={phase !== "answering"}
                data-testid={`photo-option-${label}`}
                onClick={() => pick(i)}
              >
                {label}
              </Button>
            ))}
          </div>

          {phase === "done" ? (
            <Button className="w-full" onClick={() => void next()} data-testid="photo-next">
              {isLast ? "看結果" : "下一題"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
