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
  fetchDialogueQuestions,
  fetchDialogueReview,
  submitAnswers,
} from "@/lib/api";
import type { DialogueQuestion, DialogueReview } from "@/lib/types";

const AUDIO_BASE = process.env.NEXT_PUBLIC_BLOB_BASE ?? "";
const DIALOGUE_COUNT = 3;

/* Part 4 的短講是單人獨白，但題目形狀與作答節奏跟 Part 3 的對話一樣，
   所以共用這個元件，只有文案與段落用詞不同。 */
const COPY = {
  "3": {
    hint: "對話題：先看完三個題目，按下播放後對話只播一次，聽完再作答。",
    unit: "段",
  },
  "4": {
    hint: "短講題：先看完三個題目，按下播放後短講只播一次，聽完再作答。",
    unit: "篇",
  },
} as const;

type Phase = "loading" | "reading" | "playing" | "answering" | "finished";

/* Part 3 的節奏跟 Part 2 不同：題目與四個選項要先看得到，實際考試也會給
   時間讀題再播對話。所以流程是讀題、播放一次、三題一起作答、進下一段。 */
export function Part3Runner({ part = "3" }: { part?: "3" | "4" }) {
  const copy = COPY[part];
  const [dialogues, setDialogues] = useState<DialogueQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<DialogueReview[]>([]);
  const [error, setError] = useState("");
  const [audioIssue, setAudioIssue] = useState<"" | "load" | "blocked">("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = dialogues[index];
  const isLast = index === dialogues.length - 1;
  const answeredAll =
    current?.questions.every((q) => picked[`${current.id}:${q.number}`]) ?? false;

  const load = useCallback(async () => {
    setPhase("loading");
    setError("");
    setPicked({});
    setReviews([]);
    setIndex(0);
    try {
      const data = await fetchDialogueQuestions(DIALOGUE_COUNT, part);
      if (data.questions.length === 0) {
        setError(`題庫裡沒有${copy.unit === "篇" ? "短講" : "對話"}題`);
        return;
      }
      setDialogues(data.questions);
      setPhase("reading");
    } catch (e) {
      setError(errorMessage(e, "載入題目失敗"));
    }
  }, [part, copy.unit]);

  useEffect(() => {
    void load();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [load]);

  const play = useCallback(() => {
    if (!current || !AUDIO_BASE) {
      setAudioIssue("load");
      return;
    }
    setAudioIssue("");
    setPhase("playing");

    // 換新音檔前先停掉上一個，不然舊的 play() 會被打斷、丟出看起來像故障的錯誤。
    audioRef.current?.pause();
    const audio = new Audio(`${AUDIO_BASE}/${current.audio}`);
    audioRef.current = audio;
    audio.onended = () => setPhase("answering");
    // 載不到就退回可重播的狀態。網路斷一下就把這題判死、逼人盲猜是不對的。
    audio.onerror = () => {
      setAudioIssue("load");
      setPhase("reading");
    };
    const started = audio.play();
    if (started) {
      started.catch((e: unknown) => {
        const name = e instanceof DOMException ? e.name : "";
        // AbortError 是自己的 pause 打斷了播放，不是音檔壞掉，不要報故障。
        if (name === "AbortError") {
          setPhase("reading");
          return;
        }
        setAudioIssue(name === "NotAllowedError" ? "blocked" : "load");
        setPhase("reading");
      });
    }
  }, [current]);

  const choose = useCallback(
    (questionNumber: number, label: string) => {
      if (!current) return;
      setPicked((prev) => ({ ...prev, [`${current.id}:${questionNumber}`]: label }));
    },
    [current],
  );

  const next = useCallback(async () => {
    if (!isLast) {
      setIndex((value) => value + 1);
      setAudioIssue("");
      setPhase("reading");
      return;
    }

    setPhase("loading");
    try {
      const data = await fetchDialogueReview(dialogues.map((d) => d.id));
      const byId = new Map(data.questions.map((d) => [d.id, d]));
      const ordered = dialogues
        .map((d) => byId.get(d.id))
        .filter((d): d is DialogueReview => Boolean(d));
      setReviews(ordered);

      const graded = ordered.flatMap((dialogue) =>
        dialogue.questions.map((q) => {
          const chosen = picked[`${dialogue.id}:${q.number}`] ?? "";
          return {
            question_id: `${dialogue.id}-${q.number}`,
            part,
            user_answer: chosen,
            correct_answer: q.answer,
            is_correct: chosen === q.answer,
          };
        }),
      );
      await submitAnswers({
        mode: "practice",
        part,
        answers: graded,
        time_spent_seconds: 0,
      });
      setPhase("finished");
    } catch (e) {
      setError(errorMessage(e, "取得檢討內容失敗"));
      setPhase("finished");
    }
  }, [dialogues, isLast, picked, part]);

  if (error && phase !== "finished") {
    return (
      <div className="space-y-4">
        <ErrorNotice title="出了狀況" message={error} />
        <Button onClick={() => void load()}>重新載入</Button>
      </div>
    );
  }

  if (phase === "finished") {
    const all = reviews.flatMap((d) =>
      d.questions.map((q) => ({
        right: picked[`${d.id}:${q.number}`] === q.answer,
      })),
    );
    const correct = all.filter((x) => x.right).length;
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold tabular-nums">
              {correct} / {all.length}
            </p>
            <p className="text-sm text-muted-foreground">
              答對 {all.length > 0 ? Math.round((correct / all.length) * 100) : 0}%
            </p>
            <Button className="mt-2" onClick={() => void load()}>
              <RotateCcw data-icon="inline-start" />
              再來一輪
            </Button>
          </CardContent>
        </Card>

        {reviews.map((dialogue, i) => (
          <Card key={dialogue.id}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">第 {i + 1} {copy.unit}</Badge>
                {AUDIO_BASE ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void new Audio(`${AUDIO_BASE}/${dialogue.audio}`).play()}
                  >
                    <Play data-icon="inline-start" />
                    重聽
                  </Button>
                ) : null}
              </div>

              <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                {dialogue.turns.map((turn, t) => (
                  <p key={t}>
                    <span className="font-semibold">{turn.speaker}：</span>
                    {turn.text}
                  </p>
                ))}
              </div>

              {dialogue.questions.map((q) => {
                const chosen = picked[`${dialogue.id}:${q.number}`];
                const right = chosen === q.answer;
                return (
                  <div key={q.number} className="space-y-1">
                    <p className="text-sm font-medium">
                      {q.number}. {q.text}{" "}
                      <span className={right ? "text-emerald-600" : "text-destructive"}>
                        {right ? "答對" : "答錯"}
                      </span>
                    </p>
                    <ul className="space-y-0.5 text-sm">
                      {q.options.map((option) => (
                        <li
                          key={option.label}
                          className={
                            option.label === q.answer
                              ? "font-semibold text-foreground"
                              : option.label === chosen
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {option.label}. {option.text}
                          {option.label === q.answer ? "（正解）" : null}
                          {option.label === chosen && !right ? "（你選的）" : null}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm tabular-nums text-muted-foreground" data-testid="dialogue-progress">
          第 {Math.min(index + 1, dialogues.length)} {copy.unit} / 共 {dialogues.length} {copy.unit}
        </span>
      </div>

      <Progress value={dialogues.length ? (index / dialogues.length) * 100 : 0} />

      <p className="text-sm text-muted-foreground">
        {copy.hint}
      </p>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center">
            {phase === "loading" ? (
              <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
            ) : phase === "playing" ? (
              <>
                <Headphones className="size-7 animate-pulse text-primary" aria-hidden />
                <span className="text-sm text-muted-foreground" data-testid="dialogue-state">
                  播放中，仔細聽
                </span>
              </>
            ) : phase === "reading" ? (
              <>
                <Button size="lg" onClick={play} data-testid="dialogue-play">
                  <Play data-icon="inline-start" />
                  {audioIssue === "load" ? "重新播放" : "開始播放"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {audioIssue === "blocked"
                    ? "瀏覽器擋下了播放，再點一次"
                    : audioIssue === "load"
                      ? "音檔載入失敗，再點一次重試"
                      : "只播一次"}
                </span>
                {audioIssue === "load" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="dialogue-skip-audio"
                    onClick={() => setPhase("answering")}
                  >
                    不聽了，直接作答
                  </Button>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground" data-testid="dialogue-state">
                {audioIssue === "load" ? "沒有聽到音檔，直接作答" : "播放結束，請作答"}
              </span>
            )}
          </div>

          {current?.questions.map((q) => (
            <div key={q.number} className="space-y-2">
              <p className="text-sm font-medium">
                {q.number}. {q.text}
              </p>
              <div className="grid gap-2" data-testid={`dialogue-q${q.number}`}>
                {q.options.map((option) => {
                  const chosen = picked[`${current.id}:${q.number}`] === option.label;
                  return (
                    <Button
                      key={option.label}
                      variant="outline"
                      aria-pressed={chosen}
                      // 選中要一眼看得出來：主色外框加底色，選項代號反白成圓標。
                      className={`h-auto w-full justify-start py-2 text-left text-sm whitespace-normal ${
                        chosen
                          ? "border-2 border-primary bg-primary/10 font-medium"
                          : ""
                      }`}
                      disabled={phase !== "answering"}
                      data-testid={`dialogue-q${q.number}-${option.label}`}
                      onClick={() => choose(q.number, option.label)}
                    >
                      <span
                        className={`mr-2 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          chosen
                            ? "bg-primary text-primary-foreground"
                            : "border border-border"
                        }`}
                      >
                        {option.label}
                      </span>
                      {option.text}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}

          {phase === "answering" ? (
            <Button
              className="w-full"
              disabled={!answeredAll}
              onClick={() => void next()}
              data-testid="dialogue-next"
            >
              {answeredAll ? (isLast ? "看結果" : `下一${copy.unit}`) : "三題都要作答"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
