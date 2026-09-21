#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""用 Google Cloud Text-to-Speech 產生單字發音，上傳到 Vercel Blob。

瀏覽器內建的語音來自使用者自己的裝置，Windows 與 Android 聽到的跟 macOS
不一樣，品質也參差。預先產生音檔可以讓所有人聽到同一個聲音，而且播放是
零延遲。全部單字加起來 44,066 個字元，Neural2 每月免費額度是 100 萬字元，
整批產生只用掉 4.4%，等於不花錢。

用法：
    export TOEIC_BLOB_TOKEN='vercel_blob_rw_...'
    uv run scripts/build_word_audio.py --limit 10          # 先試跑
    uv run scripts/build_word_audio.py                     # 三種口音全部
    uv run scripts/build_word_audio.py --accents gb,au     # 只補某幾種

需要 gcloud 已登入且專案啟用 Text-to-Speech API。重跑是安全的：已經存在
的音檔會被跳過，中斷之後接著跑即可。
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import subprocess
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = REPO_ROOT / "backend/data/vocabulary/words.json"

GCP_PROJECT = "dashai-490610"
TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
SPEAKING_RATE = 0.9

# 多益聽力有美、英、加、澳四種口音，但 Google TTS 沒有獨立的加拿大英語，
# 而加拿大腔與美式同屬北美音，實務上用 en-US 近似。三種都挑女聲，
# 音色一致，差別只在口音。
ACCENTS = {
    "us": ("en-US", "en-US-Neural2-F"),
    "gb": ("en-GB", "en-GB-Neural2-A"),
    "au": ("en-AU", "en-AU-Neural2-A"),
}

BLOB_API = "https://blob.vercel-storage.com"
WORKERS = 6


def gcloud_token() -> str:
    out = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


def synthesize(word: str, token: str, accent: str) -> bytes:
    language_code, voice_name = ACCENTS[accent]
    payload = json.dumps(
        {
            "input": {"text": word},
            "voice": {"languageCode": language_code, "name": voice_name},
            "audioConfig": {"audioEncoding": "MP3", "speakingRate": SPEAKING_RATE},
        }
    ).encode()
    request = urllib.request.Request(
        TTS_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Goog-User-Project": GCP_PROJECT,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.load(response)
    return base64.b64decode(body["audioContent"])


def blob_upload(pathname: str, data: bytes, token: str) -> str:
    request = urllib.request.Request(
        f"{BLOB_API}/{pathname}",
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "x-api-version": "7",
            "x-content-type": "audio/mpeg",
            # 路徑要固定，前端才能從單字 id 直接組出網址。
            "x-add-random-suffix": "0",
            "x-cache-control-max-age": "31536000",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)["url"]


def blob_list(token: str, prefix: str) -> set[str]:
    """列出已上傳的音檔，用來跳過重跑。"""
    done: set[str] = set()
    cursor = None
    while True:
        # cursor 裡有需要跳脫的字元，直接串進網址第二頁就會 400。
        params = {"prefix": prefix, "limit": "1000"}
        if cursor:
            params["cursor"] = cursor
        url = f"{BLOB_API}?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(
            url, headers={"Authorization": f"Bearer {token}", "x-api-version": "7"}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.load(response)
        for item in body.get("blobs", []):
            done.add(item["pathname"])
        cursor = body.get("cursor")
        if not body.get("hasMore") or not cursor:
            break
    return done


def main() -> int:
    parser = argparse.ArgumentParser(description="產生單字發音並上傳")
    parser.add_argument("--limit", type=int, default=0, help="只處理前 N 個，0 表示全部")
    parser.add_argument("--workers", type=int, default=WORKERS)
    parser.add_argument(
        "--accents",
        default=",".join(ACCENTS),
        help=f"要產生的口音，逗號分隔，可選 {'、'.join(ACCENTS)}",
    )
    args = parser.parse_args()

    accents = [a.strip() for a in args.accents.split(",") if a.strip()]
    unknown = [a for a in accents if a not in ACCENTS]
    if unknown:
        logger.error("不認識的口音: %s", "、".join(unknown))
        return 1

    blob_token = os.environ.get("TOEIC_BLOB_TOKEN")
    if not blob_token:
        logger.error("請先設定 TOEIC_BLOB_TOKEN")
        return 1

    words = json.loads(WORDS_PATH.read_text(encoding="utf-8"))
    if args.limit:
        words = words[: args.limit]

    gcp_token = gcloud_token()
    failures = 0

    for accent in accents:
        prefix = f"words/{accent}/"
        logger.info("[%s] 查詢已上傳的音檔", accent)
        existing = blob_list(blob_token, prefix)
        todo = [w for w in words if f"{prefix}{w['id']}.mp3" not in existing]
        logger.info("  已存在 %d，待處理 %d", len(words) - len(todo), len(todo))
        if not todo:
            logger.info("  沒有要做的事\n")
            continue

        lock = threading.Lock()
        state: dict = {"done": 0, "bytes": 0, "failed": []}

        def handle(word: dict, _accent: str = accent, _prefix: str = prefix) -> None:
            pathname = f"{_prefix}{word['id']}.mp3"
            try:
                audio = synthesize(word["word"], gcp_token, _accent)
                blob_upload(pathname, audio, blob_token)
            except (urllib.error.HTTPError, urllib.error.URLError, KeyError) as exc:
                with lock:
                    state["failed"].append((word["word"], str(exc)[:80]))
                return
            with lock:
                state["done"] += 1
                state["bytes"] += len(audio)
                if state["done"] % 500 == 0:
                    logger.info(
                        "  %d / %d  (%.1f MB)",
                        state["done"],
                        len(todo),
                        state["bytes"] / 1048576,
                    )

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(handle, w) for w in todo]
            for future in as_completed(futures):
                future.result()

        logger.info(
            "  完成 %d / %d，共 %.1f MB", state["done"], len(todo), state["bytes"] / 1048576
        )
        if state["failed"]:
            failures += len(state["failed"])
            logger.warning("  失敗 %d 筆，降低 --workers 後重跑即可補上", len(state["failed"]))
            for word, reason in state["failed"][:5]:
                logger.warning("    %s: %s", word, reason)
        logger.info("")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
