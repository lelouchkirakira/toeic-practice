#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]>=3.2"]
# ///
"""產生例句朗讀並上傳到 Vercel Blob。

單字音檔給三種口音各一男一女，例句只做一種：美式女聲 en-US-Neural2-F。
例句是整句的用法示範，聽的是句型與連音，不是拿來比較口音，一種聲音就夠。
全部 12,456 句共 734,413 個字元，Neural2 每月免費額度是 100 萬字元。

語速用 1.0。單字音檔放慢到 0.9 是為了聽清楚每個音節，例句要聽的是母語者
實際講話的節奏，放慢反而失真。

例句存在 Neon 的 toeic_words.examples，英文句子裡目標單字用 ** 標起來給
前端 highlight，送進 TTS 之前要拿掉，不然會被唸成星號。

用法：
    export DATABASE_URL='postgresql://...'
    export TOEIC_BLOB_TOKEN='vercel_blob_rw_...'
    uv run scripts/build_example_audio.py --limit 10     # 先試跑
    uv run scripts/build_example_audio.py                # 全部

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
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

GCP_PROJECT = "dashai-490610"
TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
BLOB_API = "https://blob.vercel-storage.com"

LANGUAGE_CODE = "en-US"
VOICE_NAME = "en-US-Neural2-F"
SPEAKING_RATE = 1.0
PREFIX = "examples/"
WORKERS = 6


def gcloud_token() -> str:
    out = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


class Token:
    """gcloud 的存取權杖大約一小時就過期。

    一萬兩千句要跑一個多小時，整批只取一次權杖的話後半段會全部 401。
    取權杖本身要開一個 gcloud 子行程，所以共用一份，過期才換。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._value = gcloud_token()

    def get(self) -> str:
        with self._lock:
            return self._value

    def refresh(self, stale: str) -> str:
        """stale 是呼叫端手上那份。別人已經換過就直接用新的，不重複換。"""
        with self._lock:
            if self._value == stale:
                self._value = gcloud_token()
            return self._value


def synthesize(text: str, token: Token) -> bytes:
    payload = json.dumps(
        {
            "input": {"text": text},
            "voice": {"languageCode": LANGUAGE_CODE, "name": VOICE_NAME},
            "audioConfig": {"audioEncoding": "MP3", "speakingRate": SPEAKING_RATE},
        }
    ).encode()

    access = token.get()
    for attempt in range(4):
        request = urllib.request.Request(
            TTS_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {access}",
                "X-Goog-User-Project": GCP_PROJECT,
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = json.load(response)
            return base64.b64decode(body["audioContent"])
        except urllib.error.HTTPError as exc:
            if exc.code == 401 and attempt < 3:
                access = token.refresh(access)
                continue
            # 併發太高會被限流，退一步再試，還是不行就讓呼叫端記下來。
            if exc.code == 429 and attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def blob_upload(pathname: str, data: bytes, token: str) -> str:
    request = urllib.request.Request(
        f"{BLOB_API}/{pathname}",
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "x-api-version": "7",
            "x-content-type": "audio/mpeg",
            # 路徑要固定，前端才能從單字 id 加序號直接組出網址。
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
        request = urllib.request.Request(
            f"{BLOB_API}?{urllib.parse.urlencode(params)}",
            headers={"Authorization": f"Bearer {token}", "x-api-version": "7"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.load(response)
        for item in body.get("blobs", []):
            done.add(item["pathname"])
        cursor = body.get("cursor")
        if not body.get("hasMore") or not cursor:
            break
    return done


def load_examples(database_url: str) -> list[tuple[str, str]]:
    """回傳 (pathname, 要唸的句子)，序號從 1 開始，跟前端組網址的規則一致。"""
    rows: list[tuple[str, str]] = []
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, examples FROM toeic_words"
                " WHERE jsonb_array_length(COALESCE(examples, '[]'::jsonb)) > 0"
                " ORDER BY id"
            )
            for word_id, examples in cur.fetchall():
                for index, example in enumerate(examples, start=1):
                    sentence = (example.get("en") or "").replace("**", "").strip()
                    if not sentence:
                        continue
                    rows.append((f"{PREFIX}{word_id}-{index}.mp3", sentence))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="產生例句朗讀並上傳")
    parser.add_argument("--limit", type=int, default=0, help="只處理前 N 句，0 表示全部")
    parser.add_argument("--workers", type=int, default=WORKERS)
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("請先設定 DATABASE_URL")
        return 1
    blob_token = os.environ.get("TOEIC_BLOB_TOKEN")
    if not blob_token:
        logger.error("請先設定 TOEIC_BLOB_TOKEN")
        return 1

    rows = load_examples(database_url)
    if args.limit:
        rows = rows[: args.limit]
    chars = sum(len(sentence) for _, sentence in rows)
    logger.info("例句 %d 句，共 %d 個字元", len(rows), chars)

    logger.info("查詢已上傳的音檔")
    existing = blob_list(blob_token, PREFIX)
    todo = [row for row in rows if row[0] not in existing]
    logger.info("  已存在 %d，待處理 %d", len(rows) - len(todo), len(todo))
    if not todo:
        logger.info("沒有要做的事")
        return 0

    gcp_token = Token()
    lock = threading.Lock()
    state: dict = {"done": 0, "bytes": 0, "failed": []}

    def handle(row: tuple[str, str]) -> None:
        pathname, sentence = row
        try:
            audio = synthesize(sentence, gcp_token)
            blob_upload(pathname, audio, blob_token)
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError, RuntimeError) as exc:
            with lock:
                state["failed"].append((pathname, str(exc)[:80]))
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
        futures = [pool.submit(handle, row) for row in todo]
        for future in as_completed(futures):
            future.result()

    logger.info(
        "完成 %d / %d，共 %.1f MB", state["done"], len(todo), state["bytes"] / 1048576
    )
    if state["failed"]:
        logger.warning("失敗 %d 筆，降低 --workers 後重跑即可補上", len(state["failed"]))
        for pathname, reason in state["failed"][:5]:
            logger.warning("  %s: %s", pathname, reason)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
