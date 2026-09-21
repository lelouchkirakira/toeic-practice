"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountdownBadge } from "@/components/mock-test/countdown-badge";
import { MockTestResult } from "@/components/mock-test/mock-test-result";
import {
  MockPassagePanel,
  MockQuestionPanel,
} from "@/components/mock-test/mock-panels";
import { NavDots } from "@/components/mock-test/nav-dots";
import { ErrorNotice, LoadingBlock } from "@/components/status";
import { useCountdown } from "@/hooks/use-countdown";
import { errorMessage, fetchMockTest, submitAnswers } from "@/lib/api";
import {
  correctValue,
  passageQuestionCount,
  passageQuestionId,
  questionPart,
} from "@/lib/quiz";
import type {
  AnswerItem,
  MockTestPayload,
  Passage,
  SessionResult,
} from "@/lib/types";

const TOTAL_SECONDS = 75 * 60;
const SECTIONS = [
  { key: "part5", label: "Part 5" },
  { key: "part6", label: "Part 6" },
  { key: "part7", label: "Part 7" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];
type Phase = "intro" | "loading" | "running" | "submitting" | "failed" | "done";

export default function MockTestPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [test, setTest] = useState<MockTestPayload | null>(null);
  const [section, setSection] = useState<SectionKey>("part5");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerItem>>({});
  const [result, setResult] = useState<SessionResult | null>(null);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const timer = useCountdown(TOTAL_SECONDS);
  const stopTimer = timer.stop;
  const answersRef = useRef<Record<string, AnswerItem>>({});
  const elapsedRef = useRef(0);
  const submitLockRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (phase === "running") elapsedRef.current = timer.elapsed;
  }, [phase, timer.elapsed]);

  const totalQuestions = test
    ? test.part5.length +
      passageQuestionCount(test.part6) +
      passageQuestionCount(test.part7)
    : 0;
  const answeredCount = Object.keys(answers).length;

  const submit = useCallback(async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setConfirmOpen(false);
    stopTimer();
    setPhase("submitting");
    setError("");
    try {
      const data = await submitAnswers({
        mode: "mock",
        part: "mixed",
        answers: Object.values(answersRef.current),
        time_spent_seconds: elapsedRef.current,
      });
      setResult(data);
      setPhase("done");
    } catch (e) {
      setError(errorMessage(e, "送出成績失敗"));
      setPhase("failed");
    } finally {
      submitLockRef.current = false;
    }
  }, [stopTimer]);

  // 時間到就直接結算，不讓使用者繼續作答
  useEffect(() => {
    if (phase === "running" && timer.expired) {
      void submit();
    }
  }, [phase, timer.expired, submit]);

  async function start() {
    setPhase("loading");
    setError("");
    try {
      const data = await fetchMockTest();
      setTest(data);
      setAnswers({});
      answersRef.current = {};
      setSection("part5");
      setIndex(0);
      setResult(null);
      timer.start();
      setPhase("running");
    } catch (e) {
      setError(errorMessage(e, "載入模擬考題目失敗"));
      setPhase("intro");
    }
  }

  function reset() {
    timer.reset();
    setPhase("intro");
    setTest(null);
    setAnswers({});
    answersRef.current = {};
    setSection("part5");
    setIndex(0);
    setResult(null);
    setError("");
  }

  function pick(
    questionId: string,
    part: string,
    userAnswer: string,
    correctAnswer: string,
  ) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        part,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        is_correct: userAnswer === correctAnswer,
      },
    }));
  }

  function goNext() {
    if (!test) return;
    const lengths: Record<SectionKey, number> = {
      part5: test.part5.length,
      part6: test.part6.length,
      part7: test.part7.length,
    };
    if (index < lengths[section] - 1) {
      setIndex(index + 1);
      return;
    }
    if (section === "part5") {
      setSection("part6");
      setIndex(0);
    } else if (section === "part6") {
      setSection("part7");
      setIndex(0);
    }
  }

  function passageDone(passage: Passage): boolean {
    return passage.questions.every(
      (_, qIndex) => answers[passageQuestionId(passage.id, qIndex)],
    );
  }

  if (phase === "loading") return <LoadingBlock label="正在準備試卷" />;
  if (phase === "submitting") return <LoadingBlock label="正在結算成績" />;

  if (phase === "failed") {
    return (
      <div className="space-y-4">
        <ErrorNotice title="成績沒有送出去" message={error} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-11 flex-1" onClick={() => void submit()}>
            重新送出
          </Button>
          <Button variant="outline" className="h-11 flex-1" onClick={reset}>
            回到說明頁
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return <MockTestResult result={result} onRestart={reset} />;
  }

  if (phase === "intro" || !test) {
    return (
      <div className="space-y-4">
        {error ? <ErrorNotice message={error} /> : null}
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">多益閱讀模擬考</h1>
              <p className="text-sm text-muted-foreground">
                照正式考試的節奏作答。過程中不顯示對錯，交卷後一次結算。
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between border-b border-border pb-2">
                <span>Part 5 單句填空</span>
                <span className="text-muted-foreground">30 題</span>
              </li>
              <li className="flex justify-between border-b border-border pb-2">
                <span>Part 6 段落填空</span>
                <span className="text-muted-foreground">8 篇</span>
              </li>
              <li className="flex justify-between border-b border-border pb-2">
                <span>Part 7 閱讀測驗</span>
                <span className="text-muted-foreground">10 篇</span>
              </li>
              <li className="flex justify-between">
                <span>作答時間</span>
                <span className="text-muted-foreground">75 分鐘</span>
              </li>
            </ul>
            <Button
              size="lg"
              className="h-11 w-full"
              data-testid="start-mock"
              onClick={() => void start()}
            >
              <Play data-icon="inline-start" />
              開始模擬考
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const passages = section === "part6" ? test.part6 : test.part7;
  const currentPassage = passages[index];
  const currentQuestion = test.part5[index];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CountdownBadge remaining={timer.remaining} ratio={timer.ratio} />
        <span
          className="text-sm tabular-nums text-muted-foreground"
          data-testid="mock-progress"
        >
          已作答 {answeredCount} / {totalQuestions}
        </span>
        <Button
          variant="destructive"
          className="h-9"
          data-testid="open-submit"
          onClick={() => setConfirmOpen(true)}
        >
          <Send data-icon="inline-start" />
          交卷
        </Button>
      </div>

      <Tabs
        value={section}
        onValueChange={(value) => {
          setSection(value as SectionKey);
          setIndex(0);
        }}
      >
        <TabsList className="w-full">
          {SECTIONS.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {section === "part5" ? (
        <>
          <NavDots
            count={test.part5.length}
            current={index}
            isDone={(i) => Boolean(answers[test.part5[i]?.id ?? ""])}
            onSelect={setIndex}
          />
          {currentQuestion ? (
            <MockQuestionPanel
              key={currentQuestion.id}
              question={currentQuestion}
              index={index}
              total={test.part5.length}
              selected={answers[currentQuestion.id]?.user_answer}
              onSelect={(value) =>
                pick(currentQuestion.id, "5", value, currentQuestion.answer)
              }
              onNext={goNext}
            />
          ) : null}
        </>
      ) : (
        <>
          <NavDots
            count={passages.length}
            current={index}
            isDone={(i) => {
              const passage = passages[i];
              return passage ? passageDone(passage) : false;
            }}
            onSelect={setIndex}
          />
          {currentPassage ? (
            <MockPassagePanel
              key={currentPassage.id}
              passage={currentPassage}
              index={index}
              total={passages.length}
              answerOf={(qIndex) =>
                answers[passageQuestionId(currentPassage.id, qIndex)]
                  ?.user_answer
              }
              onSelect={(qIndex, value) => {
                const question = currentPassage.questions[qIndex];
                if (!question) return;
                pick(
                  passageQuestionId(currentPassage.id, qIndex),
                  questionPart(question),
                  value,
                  correctValue(question),
                );
              }}
              onNext={goNext}
            />
          ) : null}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確定交卷</DialogTitle>
            <DialogDescription>
              已作答 {answeredCount} 題，共 {totalQuestions} 題。
              {answeredCount < totalQuestions
                ? `還有 ${totalQuestions - answeredCount} 題沒作答，未作答的題目算錯。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              再檢查一下
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-submit"
              onClick={() => void submit()}
            >
              確定交卷
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
