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

const AUDIO_BASE = process.env.NEXT_PUBLIC_BLOB_BASE ?? "";
const QUESTION_COUNT = 10;

// A、B、C 對應的是聽到的三個回答的順序，畫面上要講明白，
// 不然只看到三顆字母會不知道在選什麼。
const ORDINALS = ["第一個", "第二個", "第三個"];

type Phase = "loading" | "ready" | "playing" | "answering" | "done" | "finished";

interface Answer {
  questionId: string;
  picked: string;
}

export function Part2Runner() {
  const [questions, setQuestions] = useState<ListeningQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reviews, setReviews] = useState<ListeningReview[]>([]);
  const [error, setError] = useState("");
  const [audioIssue, setAudioIssue] = useState<"" | "load" | "blocked">("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      setPhase("ready");
    } catch (e) {
      setError(errorMessage(e, "載入題目失敗"));
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [load]);

  // 一題只播一次，跟實際考試一樣，播完就要作答。
  const play = useCallback(() => {
    if (!current || !AUDIO_BASE) {
      setAudioIssue("load");
      setPhase("answering");
      return;
    }
    setAudioIssue("");
    setPhase("playing");

    const audio = new Audio(`${AUDIO_BASE}/${current.audio}`);
    audioRef.current = audio;
    audio.onended = () => setPhase("answering");
    // 音檔本身載不到就直接放行，讓人跳過這題而不是卡在這裡。
    audio.onerror = () => {
      setAudioIssue("load");
      setPhase("answering");
    };

    const started = audio.play();
    if (started) {
      started.catch((e: unknown) => {
        // 瀏覽器擋下播放時這題還沒播過，退回可重播的狀態，不要算作聽過了。
        const blocked = e instanceof DOMException && e.name === "NotAllowedError";
        setAudioIssue(blocked ? "blocked" : "load");
        setPhase(blocked ? "ready" : "answering");
      });
    }
  }, [current]);

  const pick = useCallback(
    (label: string) => {
      if (!current) return;
      setAnswers((prev) => [...prev, { questionId: current.id, picked: label }]);
      setPhase("done");
    },
    [current],
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
                  {AUDIO_BASE ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void new Audio(`${AUDIO_BASE}/${review.audio}`).play()}
                    >
                      <Play data-icon="inline-start" />
                      重聽
                    </Button>
                  ) : null}
                </div>
                <p className="font-medium">{review.prompt}</p>
                <ul className="space-y-1 text-sm">
                  {review.options.map((option) => (
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
                      {option.label}. {option.text}
                      {option.label === review.answer ? "（正解）" : null}
                      {option.label === picked && !right ? "（你選的）" : null}
                    </li>
                  ))}
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
        聽完後選出最適合的那個回答。每題只播一次。
      </p>

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
                  開始播放
                </Button>
                <span className="text-sm text-muted-foreground">
                  {audioIssue === "blocked"
                    ? "瀏覽器擋下了播放，再點一次"
                    : "只播一次，聽完再作答"}
                </span>
              </>
            ) : (
              <>
                <Headphones className="size-8 text-muted-foreground" aria-hidden />
                <span className="text-sm text-muted-foreground" data-testid="listening-state">
                  {audioIssue === "load"
                    ? "音檔載入失敗，可以跳過這題"
                    : "播放結束，選一個最適合的回答"}
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2" data-testid="listening-options">
            {(current?.option_labels ?? ["A", "B", "C"]).map((label, i) => (
              <Button
                key={label}
                variant="outline"
                size="lg"
                aria-pressed={answers[index]?.picked === label}
                className={`flex h-auto w-full flex-col gap-0.5 py-2.5 ${
                  answers[index]?.picked === label
                    ? "border-2 border-primary bg-primary/10"
                    : ""
                }`}
                disabled={phase !== "answering"}
                data-testid={`listening-option-${label}`}
                onClick={() => pick(label)}
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
