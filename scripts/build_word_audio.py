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
    uv run scripts/build_word_audio.py --limit 10     # 先試跑
    uv run scripts/build_word_audio.py                # 全部

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
# Neural2-F 是女聲美式，跟 macOS 的 Samantha 音色接近，聽感一致。
VOICE_NAME = "en-US-Neural2-F"
SPEAKING_RATE = 0.9

BLOB_API = "https://blob.vercel-storage.com"
BLOB_PREFIX = "words/"
WORKERS = 12


def gcloud_token() -> str:
    out = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


def synthesize(word: str, token: str) -> bytes:
    payload = json.dumps(
        {
            "input": {"text": word},
            "voice": {"languageCode": "en-US", "name": VOICE_NAME},
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


def blob_list(token: str) -> set[str]:
    """列出已上傳的音檔，用來跳過重跑。"""
    done: set[str] = set()
    cursor = None
    while True:
        # cursor 裡有需要跳脫的字元，直接串進網址第二頁就會 400。
        params = {"prefix": BLOB_PREFIX, "limit": "1000"}
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
    args = parser.parse_args()

    blob_token = os.environ.get("TOEIC_BLOB_TOKEN")
    if not blob_token:
        logger.error("請先設定 TOEIC_BLOB_TOKEN")
        return 1

    words = json.loads(WORDS_PATH.read_text(encoding="utf-8"))
    if args.limit:
        words = words[: args.limit]

    logger.info("查詢已上傳的音檔")
    existing = blob_list(blob_token)
    todo = [w for w in words if f"{BLOB_PREFIX}{w['id']}.mp3" not in existing]
    logger.info("  已存在 %d，待處理 %d\n", len(words) - len(todo), len(todo))
    if not todo:
        logger.info("沒有要做的事")
        return 0

    gcp_token = gcloud_token()
    lock = threading.Lock()
    state = {"done": 0, "bytes": 0, "failed": []}
    base_url: list[str] = []

    def handle(word: dict) -> None:
        pathname = f"{BLOB_PREFIX}{word['id']}.mp3"
        try:
            audio = synthesize(word["word"], gcp_token)
            url = blob_upload(pathname, audio, blob_token)
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError) as exc:
            with lock:
                state["failed"].append((word["word"], str(exc)[:80]))
            return
        with lock:
            state["done"] += 1
            state["bytes"] += len(audio)
            if not base_url:
                base_url.append(url.rsplit("/", 2)[0])
            if state["done"] % 250 == 0:
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

    logger.info("")
    logger.info("完成 %d / %d，共 %.1f MB", state["done"], len(todo), state["bytes"] / 1048576)
    if base_url:
        logger.info("音檔網址前綴：%s/%s", base_url[0], BLOB_PREFIX.rstrip("/"))
    if state["failed"]:
        logger.warning("失敗 %d 筆：", len(state["failed"]))
        for word, reason in state["failed"][:10]:
            logger.warning("  %s: %s", word, reason)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
