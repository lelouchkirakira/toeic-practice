#!/usr/bin/env python3
"""題庫檢查：匯入資料庫之前先擋掉壞題。

用法：
    python3 scripts/check_questions.py backend/data/question_bank/part5.json
    python3 scripts/check_questions.py new-batch.json --against backend/data/question_bank/part5.json

檢查項目見 openspec/changes/019-question-bank-generation.md。
退件的題目會逐條列出原因，全部通過才回傳 0。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

BLANK = re.compile(r"_{3,}")
PASSAGE_BLANK = re.compile(r"_\((\d)\)_")
ID_FORMAT = re.compile(r"^toeic_part(\d)_(\d{3})$")
ALLOWED_CATEGORIES = {
    "verb tense",
    "word form",
    "preposition",
    "conjunction",
    "pronoun",
    "comparison",
    "relative clause",
    "passive voice",
    "subjunctive",
    "gerund/infinitive",
    "vocabulary",
    "quantifier",
}
# 正解位置偏差門檻：四個位置各佔兩成五，單一位置超過四成或低於一成就算偏。
POSITION_HIGH = 0.40
POSITION_LOW = 0.10
SENTENCE_MIN_WORDS = 8
SENTENCE_MAX_WORDS = 35
EXPLANATION_MIN = 40
PASSAGE_MIN_WORDS = 80
PASSAGE_MAX_WORDS = 220


def normalize(sentence: str) -> str:
    """去掉空格記號與標點大小寫差異，用來比對重複。"""
    text = BLANK.sub(" ", sentence).lower()
    text = "".join(c for c in text if not unicodedata.category(c).startswith("P"))
    return " ".join(text.split())


def check_options(options: list, answer, explanation: str, where: str) -> list[str]:
    """Part 6 與 Part 7 共用：四個選項、正解在內、解析要點名錯的。"""
    problems: list[str] = []
    if len(options) != 4:
        problems.append(f"{where} 選項要四個，找到 {len(options)} 個")
    if len(set(map(str, options))) != len(options):
        problems.append(f"{where} 選項有重複")

    if isinstance(answer, int):
        if not 1 <= answer <= len(options):
            problems.append(f"{where} 正解序號 {answer} 不在 1 到 {len(options)}")
        correct = options[answer - 1] if 1 <= answer <= len(options) else None
    else:
        if answer not in options:
            problems.append(f"{where} 正解不在選項內：{answer!r}")
        correct = answer

    if len(explanation) < EXPLANATION_MIN:
        problems.append(f"{where} 解析太短（{len(explanation)} 字）")
    elif correct is not None:
        wrong = [str(o) for o in options if o != correct]
        lowered = explanation.lower()
        quoted = any(str(o).lower()[:30] in lowered for o in wrong)
        # 選項是整句時（Part 6 的句子插入、Part 7），解析通常改寫而不是整句照抄，
        # 所以只要提到錯誤選項裡的實詞就算有交代。選項是單字時仍然要求照抄。
        long_options = max((len(str(o)) for o in options), default=0) > 25
        paraphrased = False
        if long_options:
            for option in wrong:
                words = {w for w in re.findall(r"[a-z]{5,}", str(option).lower())}
                if any(w in lowered for w in words):
                    paraphrased = True
                    break
        # 也接受「the first option」這種序數指稱，解析照樣有交代到哪個選項錯。
        if long_options and not paraphrased:
            paraphrased = bool(
                re.search(r"\b(first|second|third|fourth)\b|option [ABCD]\b", explanation, re.I)
            )
        if not quoted and not paraphrased:
            problems.append(f"{where} 解析沒有提到任何一個錯誤選項")
    return problems


def check_passage_item(item: dict, seen_ids: set[str]) -> list[str]:
    """Part 6 與 Part 7：一篇文章帶數題。"""
    problems: list[str] = []
    qid = item.get("id", "")
    if not ID_FORMAT.match(qid):
        problems.append(f"id 格式不對：{qid!r}")
    if qid in seen_ids:
        problems.append(f"id 重複：{qid}")
    seen_ids.add(qid)

    passage = item.get("passage", "")
    words = len(passage.split())
    if not PASSAGE_MIN_WORDS <= words <= PASSAGE_MAX_WORDS:
        problems.append(f"文章長度 {words} 字，應在 {PASSAGE_MIN_WORDS} 到 {PASSAGE_MAX_WORDS} 之間")
    for ch in passage:
        if ord(ch) > 0x2019:
            problems.append(f"文章出現非英文字元：{ch!r}")
            break
    if not item.get("passage_type"):
        problems.append("缺 passage_type")

    questions = item.get("questions", [])
    if not questions:
        problems.append("沒有題目")

    blanks = [int(n) for n in PASSAGE_BLANK.findall(passage)]
    if blanks:
        # Part 6：文章裡的空格編號要與題目的 blank_number 對得上
        numbers = [q.get("blank_number") for q in questions]
        if blanks != sorted(blanks) or blanks != list(range(1, len(blanks) + 1)):
            problems.append(f"文章空格編號不連續：{blanks}")
        if sorted(numbers) != sorted(blanks):
            problems.append(f"空格 {blanks} 與題目 blank_number {numbers} 對不上")

    for n, q in enumerate(questions, 1):
        where = f"第 {n} 題"
        problems += check_options(
            q.get("options", []), q.get("answer"), q.get("explanation", ""), where
        )
        if not blanks and not q.get("question"):
            problems.append(f"{where} 缺題目文字")
    return problems


def check_item(item: dict, seen_ids: set[str], seen_sentences: dict[str, str]) -> list[str]:
    problems: list[str] = []
    qid = item.get("id", "")

    if not ID_FORMAT.match(qid):
        problems.append(f"id 格式不對：{qid!r}，應為 toeic_part<N>_<三位數>")
    if qid in seen_ids:
        problems.append(f"id 重複：{qid}")
    seen_ids.add(qid)

    sentence = item.get("sentence", "")
    blanks = BLANK.findall(sentence)
    if len(blanks) != 1:
        problems.append(f"句子要剛好一個空格記號，找到 {len(blanks)} 個")
    words = len(sentence.split())
    if not SENTENCE_MIN_WORDS <= words <= SENTENCE_MAX_WORDS:
        problems.append(f"句子長度 {words} 字，應在 {SENTENCE_MIN_WORDS} 到 {SENTENCE_MAX_WORDS} 之間")
    for ch in sentence:
        if ord(ch) > 0x2019:
            problems.append(f"句子出現非英文字元：{ch!r}")
            break

    options = item.get("options", [])
    if len(options) != 4:
        problems.append(f"選項要四個，找到 {len(options)} 個")
    if len(set(options)) != len(options):
        dup = [o for o, n in Counter(options).items() if n > 1]
        problems.append(f"選項重複：{dup}")
    answer = item.get("answer", "")
    if answer not in options:
        problems.append(f"正解不在選項內：{answer!r}")

    explanation = item.get("explanation", "")
    if len(explanation) < EXPLANATION_MIN:
        problems.append(f"解析太短（{len(explanation)} 字），要說明錯誤選項為什麼錯")
    elif answer in options:
        wrong = [o for o in options if o != answer]
        mentioned = sum(1 for o in wrong if o.lower() in explanation.lower())
        if mentioned == 0:
            problems.append("解析沒有提到任何一個錯誤選項")

    category = item.get("grammar_category", "")
    if category not in ALLOWED_CATEGORIES:
        problems.append(f"文法分類不在清單內：{category!r}")

    key = normalize(sentence)
    if key in seen_sentences:
        problems.append(f"句子與 {seen_sentences[key]} 重複")
    else:
        seen_sentences[key] = qid

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description="檢查題庫 JSON")
    parser.add_argument("target", type=Path, help="要檢查的題庫檔")
    parser.add_argument(
        "--against",
        type=Path,
        nargs="*",
        default=[],
        help="一併比對重複的既有題庫檔",
    )
    args = parser.parse_args()

    seen_ids: set[str] = set()
    seen_sentences: dict[str, str] = {}
    for existing in args.against:
        for item in json.loads(existing.read_text(encoding="utf-8")):
            seen_ids.add(item.get("id", ""))
            seen_sentences[normalize(item.get("sentence", ""))] = item.get("id", "")

    items = json.loads(args.target.read_text(encoding="utf-8"))
    passage_mode = bool(items) and "questions" in items[0]
    failures = 0
    for item in items:
        problems = (
            check_passage_item(item, seen_ids)
            if passage_mode
            else check_item(item, seen_ids, seen_sentences)
        )
        if problems:
            failures += 1
            print(f"\n{item.get('id', '(無 id)')}")
            for problem in problems:
                print(f"  - {problem}")

    if passage_mode:
        positions = Counter()
        for item in items:
            for q in item.get("questions", []):
                answer, options = q.get("answer"), q.get("options", [])
                if isinstance(answer, int) and 1 <= answer <= len(options):
                    positions[answer - 1] += 1
                elif answer in options:
                    positions[options.index(answer)] += 1
    else:
        positions = Counter(
            item["options"].index(item["answer"])
            for item in items
            if item.get("answer") in item.get("options", [])
        )
    total = sum(positions.values())
    print(f"\n共 {len(items)} 題，退件 {failures} 題")
    if total:
        spread = "  ".join(
            f"{'ABCD'[i]}={positions.get(i, 0)}({positions.get(i, 0) / total:.0%})" for i in range(4)
        )
        print(f"正解位置：{spread}")
        for i in range(4):
            share = positions.get(i, 0) / total
            if share > POSITION_HIGH or share < POSITION_LOW:
                print(f"  警告：正解落在 {'ABCD'[i]} 的比例 {share:.0%} 偏離平均，改題時往其他位置調")

    if passage_mode:
        types = Counter(item.get("passage_type", "") for item in items)
        counts = Counter(len(item.get("questions", [])) for item in items)
        print("文章型態：" + "  ".join(f"{k}={v}" for k, v in types.most_common()))
        print("每組題數：" + "  ".join(f"{k} 題={v} 組" for k, v in sorted(counts.items())))
    else:
        categories = Counter(item.get("grammar_category", "") for item in items)
        print("文法分類：" + "  ".join(f"{k}={v}" for k, v in categories.most_common()))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
