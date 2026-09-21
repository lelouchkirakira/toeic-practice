"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackPanel } from "@/components/quiz/feedback-panel";
import { OptionButton, type OptionState } from "@/components/quiz/option-button";
import { optionLetter } from "@/lib/format";
import type { Question } from "@/lib/types";

export function QuestionCard({
  question,
  index,
  total,
  isLast,
  onAnswer,
  onNext,
}: {
  question: Question;
  index: number;
  total: number;
  isLast: boolean;
  onAnswer: (userAnswer: string) => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = submitted && selected === question.answer;

  function optionState(option: string): OptionState {
    if (!submitted) return selected === option ? "selected" : "idle";
    if (option === question.answer) return "correct";
    if (option === selected) return "incorrect";
    return "muted";
  }

  function submit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    onAnswer(selected);
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            第 {index + 1} 題 / 共 {total} 題
          </span>
          <div className="flex flex-wrap gap-1.5">
            {question.grammar_category ? (
              <Badge variant="secondary">{question.grammar_category}</Badge>
            ) : null}
            {question.band ? (
              <Badge variant="outline">難度 {question.band}</Badge>
            ) : null}
          </div>
        </div>

        <p className="text-base leading-relaxed break-words">
          {question.sentence}
        </p>

        <div className="space-y-2">
          {question.options.map((option, i) => (
            <OptionButton
              key={`${option}-${i}`}
              marker={optionLetter(i)}
              label={option}
              state={optionState(option)}
              disabled={submitted}
              onClick={() => setSelected(option)}
            />
          ))}
        </div>

        {!submitted && selected ? (
          <Button
            size="lg"
            className="h-11 w-full"
            data-testid="submit-answer"
            onClick={submit}
          >
            <Check data-icon="inline-start" />
            送出答案
          </Button>
        ) : null}

        {submitted ? (
          <div className="space-y-3">
            <FeedbackPanel
              isCorrect={isCorrect}
              explanation={question.explanation}
            />
            <Button
              size="lg"
              variant="outline"
              className="h-11 w-full"
              data-testid="next-question"
              onClick={onNext}
            >
              {isLast ? "看成績" : "下一題"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
