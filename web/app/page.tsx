"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PartSelector } from "@/components/quiz/part-selector";
import { PassageCard } from "@/components/quiz/passage-card";
import { QuestionCard } from "@/components/quiz/question-card";
import { ScoreBoard } from "@/components/quiz/score-board";
import { ErrorNotice, InfoNotice, LoadingBlock } from "@/components/status";
import {
  errorMessage,
  fetchQuestions,
  fetchVocabularyQuiz,
  submitAnswers,
} from "@/lib/api";
import { countQuestions, passageQuestionId } from "@/lib/quiz";
import type {
  AnswerItem,
  PartKey,
  Question,
  QuizItem,
  SessionResult,
} from "@/lib/types";
import { isPassage } from "@/lib/types";

type Phase = "setup" | "loading" | "running" | "submitting" | "failed" | "done";

/** 混合題的單題其實是 Part 5，從題目 id 取回真正的 part */
function resolveQuestionPart(configPart: PartKey, question: Question): string {
  if (configPart !== "mixed") return configPart;
  const matched = /^toeic_part(\d)_/.exec(question.id);
  return matched ? matched[1] : "5";
}

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [part, setPart] = useState<PartKey>("5");
  const [items, setItems] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [error, setError] = useState("");

  const answersRef = useRef<AnswerItem[]>([]);
  const startedAtRef = useRef(0);

  const totalQuestions = countQuestions(items);
  const currentItem = items[index];
  const isLastItem = index >= items.length - 1;
  const progress =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  function record(answer: AnswerItem) {
    answersRef.current = [...answersRef.current, answer];
    setAnsweredCount(answersRef.current.length);
  }

  async function start(nextPart: PartKey, count: number) {
    setPhase("loading");
    setError("");
    setPart(nextPart);
    setItems([]);
    setIndex(0);
    setResult(null);
    answersRef.current = [];
    setAnsweredCount(0);

    try {
      const data =
        nextPart === "vocab"
          ? await fetchVocabularyQuiz(count)
          : await fetchQuestions(nextPart, count);
      setItems(data);
      startedAtRef.current = Date.now();
      setPhase("running");
    } catch (e) {
      setError(errorMessage(e, "載入題目失敗"));
      setPhase("setup");
    }
  }

  async function finish() {
    setPhase("submitting");
    setError("");
    try {
      const data = await submitAnswers({
        mode: "practice",
        part,
        answers: answersRef.current,
        time_spent_seconds: Math.round(
          (Date.now() - startedAtRef.current) / 1000,
        ),
      });
      setResult(data);
      setPhase("done");
    } catch (e) {
      setError(errorMessage(e, "送出成績失敗"));
      setPhase("failed");
    }
  }

  function goNext() {
    if (index < items.length - 1) {
      setIndex(index + 1);
      return;
    }
    void finish();
  }

  function backToSetup() {
    setPhase("setup");
    setError("");
    setItems([]);
    setIndex(0);
    setResult(null);
    answersRef.current = [];
    setAnsweredCount(0);
  }

  if (phase === "loading") {
    return <LoadingBlock label="正在抽題" />;
  }

  if (phase === "submitting") {
    return <LoadingBlock label="正在送出成績" />;
  }

  if (phase === "failed") {
    return (
      <div className="space-y-4">
        <ErrorNotice title="成績沒有送出去" message={error} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-11 flex-1" onClick={() => void finish()}>
            重新送出
          </Button>
          <Button variant="outline" className="h-11 flex-1" onClick={backToSetup}>
            回到選單
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return <ScoreBoard result={result} onRestart={backToSetup} />;
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        {error ? <ErrorNotice message={error} /> : null}
        <PartSelector
          onStart={(nextPart, count) => void start(nextPart, count)}
        />
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="space-y-4">
        <InfoNotice message="這個條件下沒有題目，換一個題型再試一次。" />
        <Button className="h-11 w-full" onClick={backToSetup}>
          回到選單
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>作答進度</span>
          <span className="tabular-nums" data-testid="practice-progress">
            {answeredCount} / {totalQuestions}
          </span>
        </div>
        <Progress value={progress} />
      </div>

      {isPassage(currentItem) ? (
        <PassageCard
          key={currentItem.id}
          passage={currentItem}
          index={index}
          total={items.length}
          isLast={isLastItem}
          onAnswer={(questionIndex, questionPartKey, userAnswer, correctAnswer) =>
            record({
              question_id: passageQuestionId(currentItem.id, questionIndex),
              part: questionPartKey,
              user_answer: userAnswer,
              correct_answer: correctAnswer,
              is_correct: userAnswer === correctAnswer,
            })
          }
          onNext={goNext}
        />
      ) : (
        <QuestionCard
          key={currentItem.id}
          question={currentItem}
          index={index}
          total={items.length}
          isLast={isLastItem}
          onAnswer={(userAnswer) =>
            record({
              question_id: currentItem.id,
              part: resolveQuestionPart(part, currentItem),
              user_answer: userAnswer,
              correct_answer: currentItem.answer,
              is_correct: userAnswer === currentItem.answer,
              grammar_category: currentItem.grammar_category,
            })
          }
          onNext={goNext}
        />
      )}
    </div>
  );
}
