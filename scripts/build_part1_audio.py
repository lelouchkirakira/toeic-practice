#!/usr/bin/env python3
"""產生 Part 1 看圖題的語音：每題四句描述各一個檔，另補一個字母 D。

2026-09 的 Google 語音額度已經用完，使用者決定等 10 月額度重置後才合成。

Google Cloud 的帳單月份以美國太平洋時間切換，不是台灣時間。10 月 1 日台灣
早上到下午三點，太平洋時間還是 9 月 30 日，那時候合成仍算 9 月的用量、照價收費。
所以這支用太平洋時間判斷，而且再多留一小時緩衝：台灣時間 10 月 1 日 16:00 以後
才會真的執行，在那之前一律拒絕，--force 也不放行。

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
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent))
from build_listening_audio import VOICES, gcloud_token, synthesize  # noqa: E402
from split_part2_audio import synthesize_letter  # noqa: E402

BANK = Path("backend/data/question_bank/part1.json")
OUT = Path("web/public/audio")
PACIFIC = ZoneInfo("America/Los_Angeles")
TAIPEI = ZoneInfo("Asia/Taipei")
# 太平洋時間 10 月 1 日 00:00 帳單月份切換，多留一小時緩衝。
SAFE_FROM = dt.datetime(2026, 10, 1, 1, 0, tzinfo=PACIFIC)
# 真實考試每題由不同口音唸，這裡依題號輪流。
VOICE_ROTATION = [key for key in ("us-f", "gb-m", "au-f", "us-m", "gb-f") if key in VOICES]


def main() -> int:
    parser = argparse.ArgumentParser(description="產生 Part 1 描述語音")
    parser.add_argument("--dry-run", action="store_true", help="只算字元數不合成")
    args = parser.parse_args()

    items = json.loads(BANK.read_text(encoding="utf-8"))
    chars = sum(len(s["text"]) for item in items for s in item["statements"]) + 1
    print(f"{len(items)} 題，共 {chars} 個字元（含字母 D）")
    if args.dry_run:
        return 0
    now = dt.datetime.now(tz=PACIFIC)
    print(f"現在太平洋時間 {now:%Y-%m-%d %H:%M}，台灣時間 {now.astimezone(TAIPEI):%Y-%m-%d %H:%M}")
    if now < SAFE_FROM:
        print(
            "Google 帳單月份還沒切到 10 月，現在合成仍算 9 月用量、會照價收費，不執行。"
            f"最早可以跑的時間是台灣 {SAFE_FROM.astimezone(TAIPEI):%Y-%m-%d %H:%M}。"
        )
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
