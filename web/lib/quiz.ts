import type { AnswerItem, Passage, PassageQuestion, QuizItem } from "./types";
import { isPassage } from "./types";

/** 文章題的子題 id，與 Vue 版一致，維持後端統計可比對 */
export function passageQuestionId(passageId: string, index: number): string {
  return `${passageId}_q${index + 1}`;
}

/** Part 6 的答案是選項文字，Part 7 的答案是 1 起算的序號 */
export function optionValue(question: PassageQuestion, index: number): string {
  if (question.blank_number) return question.options[index] ?? "";
  return String(index + 1);
}

export function correctValue(question: PassageQuestion): string {
  return String(question.answer);
}

export function questionPart(question: PassageQuestion): string {
  return question.blank_number ? "6" : "7";
}

/** 混合題的回傳會同時含單題與文章題，題數要逐項加總 */
export function countQuestions(items: QuizItem[]): number {
  return items.reduce(
    (sum, item) => sum + (isPassage(item) ? item.questions.length : 1),
    0,
  );
}

export function passageQuestionCount(passages: Passage[]): number {
  return passages.reduce((sum, p) => sum + p.questions.length, 0);
}

export function correctCount(answers: AnswerItem[]): number {
  return answers.filter((a) => a.is_correct).length;
}
