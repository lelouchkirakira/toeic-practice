"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FeedbackPanel } from "@/components/quiz/feedback-panel";
import { OptionButton, type OptionState } from "@/components/quiz/option-button";
import { passageTypeLabel } from "@/lib/format";
import { correctValue, optionValue, questionPart } from "@/lib/quiz";
import type { Passage } from "@/lib/types";

export function PassageCard({
  passage,
  index,
  total,
  isLast,
  onAnswer,
  onNext,
}: {
  passage: Passage;
  index: number;
  total: number;
  isLast: boolean;
  onAnswer: (
    questionIndex: number,
    part: string,
    userAnswer: string,
    correctAnswer: string,
  ) => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});

  const allSubmitted = passage.questions.every((_, i) => submitted[i]);

  function submitQuestion(qIndex: number) {
    const question = passage.questions[qIndex];
    const userAnswer = selected[qIndex];
    if (!question || !userAnswer || submitted[qIndex]) return;
    setSubmitted((prev) => ({ ...prev, [qIndex]: true }));
    onAnswer(
      qIndex,
      questionPart(question),
      userAnswer,
      correctValue(question),
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            第 {index + 1} 篇 / 共 {total} 篇
          </span>
          <Badge variant="secondary">
            {passageTypeLabel(passage.passage_type)}
          </Badge>
        </div>

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm leading-7 whitespace-pre-wrap break-words">
            {passage.passage}
          </p>
        </div>

        <div className="space-y-6">
          {passage.questions.map((question, qIndex) => {
            const answered = Boolean(submitted[qIndex]);
            const picked = selected[qIndex];
            const correct = correctValue(question);

            const optionState = (value: string): OptionState => {
              if (!answered) return picked === value ? "selected" : "idle";
              if (value === correct) return "correct";
              if (value === picked) return "incorrect";
              return "muted";
            };

            return (
              <div key={qIndex} className="space-y-3">
                <Separator />
                <p className="text-sm font-semibold break-words">
                  {question.blank_number
                    ? `空格 (${question.blank_number})`
                    : `第 ${qIndex + 1} 題　${question.question ?? ""}`}
                </p>

                <div className="space-y-2">
                  {question.options.map((option, oIndex) => {
                    const value = optionValue(question, oIndex);
                    return (
                      <OptionButton
                        key={`${option}-${oIndex}`}
                        marker={String(oIndex + 1)}
                        label={option}
                        state={optionState(value)}
                        disabled={answered}
                        onClick={() =>
                          setSelected((prev) => ({ ...prev, [qIndex]: value }))
                        }
                      />
                    );
                  })}
                </div>

                {!answered && picked ? (
                  <Button
                    className="h-10 w-full"
                    data-testid="submit-answer"
                    onClick={() => submitQuestion(qIndex)}
                  >
                    <Check data-icon="inline-start" />
                    送出這題
                  </Button>
                ) : null}

                {answered ? (
                  <FeedbackPanel
                    isCorrect={picked === correct}
                    explanation={question.explanation}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {allSubmitted ? (
          <Button
            size="lg"
            variant="outline"
            className="h-11 w-full"
            data-testid="next-question"
            onClick={onNext}
          >
            {isLast ? "看成績" : "下一篇"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
