#!/usr/bin/env python3
"""把正解位置重新洗平。

出題的時候正解常常集中在同一個位置，考生會發現。這支用固定亂數重排每題的選項，
讓四個位置的次數盡量平均，內容不動。

用法：
    python3 scripts/rebalance_answers.py backend/data/question_bank/part6.json
"""
from __future__ import annotations

import json
import random
import sys
from collections import Counter
from pathlib import Path


def target_positions(count: int, seed: int) -> list[int]:
    """產生盡量平均的目標位置序列。"""
    base = [i % 4 for i in range(count)]
    random.Random(seed).shuffle(base)
    return base


def move_answer(options: list, correct_index: int, target: int) -> tuple[list, int]:
    """把正解搬到指定位置，其餘選項維持相對順序。"""
    rest = [o for i, o in enumerate(options) if i != correct_index]
    out = rest[:target] + [options[correct_index]] + rest[target:]
    return out, target


def rebalance(path: Path) -> None:
    items = json.loads(path.read_text(encoding="utf-8"))
    flat = []
    for item in items:
        if "questions" in item:
            flat.extend(item["questions"])
        else:
            flat.append(item)

    targets = target_positions(len(flat), seed=20260923)
    for question, target in zip(flat, targets):
        options = question["options"]
        answer = question["answer"]
        if isinstance(answer, int):
            current = answer - 1
            options, moved = move_answer(options, current, target)
            question["options"] = options
            question["answer"] = moved + 1
        else:
            if answer not in options:
                continue
            options, moved = move_answer(options, options.index(answer), target)
            question["options"] = options

    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    spread = Counter()
    for question in flat:
        answer = question["answer"]
        options = question["options"]
        if isinstance(answer, int):
            spread[answer - 1] += 1
        elif answer in options:
            spread[options.index(answer)] += 1
    total = sum(spread.values())
    print(path.name, "→", "  ".join(f"{'ABCD'[i]}={spread[i]}({spread[i] / total:.0%})" for i in range(4)))


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        rebalance(Path(arg))
