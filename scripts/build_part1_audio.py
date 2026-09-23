#!/usr/bin/env python3
"""產生 Part 1 看圖題的語音：每題四句描述各一個檔，另補一個字母 D。

2026-09 的 Google 語音額度已經用完，使用者決定等 10 月 1 日重置後才合成。
這支在 10 月 1 日之前會直接拒絕執行，要強制才加 --force。

輸出：
    web/public/audio/part1/<題號>/a.mp3 b.mp3 c.mp3 d.mp3
    web/public/audio/letters/d.mp3   （A B C 在做 Part 2 時已經產好）

跑完之後在 Vercel 設 NEXT_PUBLIC_PART1_READY=1 並重新部署，聽力頁才會露出 Part 1。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_listening_audio import VOICES, gcloud_token, synthesize  # noqa: E402
from split_part2_audio import synthesize_letter  # noqa: E402

BANK = Path("backend/data/question_bank/part1.json")
OUT = Path("web/public/audio")
QUOTA_RESET = dt.date(2026, 10, 1)
# 真實考試每題由不同口音唸，這裡依題號輪流。
VOICE_ROTATION = [key for key in ("us-f", "gb-m", "au-f", "us-m", "gb-f") if key in VOICES]


def main() -> int:
    parser = argparse.ArgumentParser(description="產生 Part 1 描述語音")
    parser.add_argument("--force", action="store_true", help="10 月 1 日之前也要執行")
    parser.add_argument("--dry-run", action="store_true", help="只算字元數不合成")
    args = parser.parse_args()

    items = json.loads(BANK.read_text(encoding="utf-8"))
    chars = sum(len(s["text"]) for item in items for s in item["statements"]) + 1
    print(f"{len(items)} 題，共 {chars} 個字元（含字母 D）")
    if args.dry_run:
        return 0
    if dt.date.today() < QUOTA_RESET and not args.force:
        print(f"今天 {dt.date.today()}，語音額度 {QUOTA_RESET} 才重置，照使用者決定不合成。要強制請加 --force")
        return 1

    token = gcloud_token()
    for n, item in enumerate(items):
        voice = VOICE_ROTATION[n % len(VOICE_ROTATION)]
        folder = OUT / "part1" / item["id"]
        folder.mkdir(parents=True, exist_ok=True)
        for statement in item["statements"]:
            target = folder / f"{statement['label'].lower()}.mp3"
            if target.exists():
                continue
            target.write_bytes(synthesize(statement["text"], voice, token))
        print(f"  {item['id']}（{voice}）")

    letter_d = OUT / "letters" / "d.mp3"
    if not letter_d.exists():
        letter_d.write_bytes(synthesize_letter("D", token))
        print("  字母 D")
    return 0


if __name__ == "__main__":
    sys.exit(main())
