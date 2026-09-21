"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OptionButton } from "@/components/quiz/option-button";
import { optionLetter, passageTypeLabel } from "@/lib/format";
import { optionValue } from "@/lib/quiz";
import type { Passage, Question } from "@/lib/types";

export function MockQuestionPanel({
  question,
  index,
  total,
  selected,
  onSelect,
  onNext,
}: {
  question: Question;
  index: number;
  total: number;
  selected?: string;
  onSelect: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          第 {index + 1} 題 / 共 {total} 題
        </p>
        <p className="text-base leading-relaxed break-words">
          {question.sentence}
        </p>
        <div className="space-y-2">
          {question.options.map((option, i) => (
            <OptionButton
              key={`${option}-${i}`}
              marker={optionLetter(i)}
              label={option}
              state={selected === option ? "selected" : "idle"}
              onClick={() => onSelect(option)}
            />
          ))}
        </div>
        <Button variant="outline" className="h-10 w-full" onClick={onNext}>
          下一題
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function MockPassagePanel({
  passage,
  index,
  total,
  answerOf,
  onSelect,
  onNext,
}: {
  passage: Passage;
  index: number;
  total: number;
  answerOf: (questionIndex: number) => string | undefined;
  onSelect: (questionIndex: number, value: string) => void;
  onNext: () => void;
}) {
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
          {passage.questions.map((question, qIndex) => (
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
                      state={answerOf(qIndex) === value ? "selected" : "idle"}
                      onClick={() => onSelect(qIndex, value)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="h-10 w-full" onClick={onNext}>
          下一篇
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardContent>
    </Card>
  );
}
