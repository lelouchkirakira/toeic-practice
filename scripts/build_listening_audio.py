#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""產生聽力 Part 2 的音檔並上傳到 Vercel Blob。

實際考試裡問句與三個回答是不同人講的，而且刻意讓不同國家的人對話，所以
問句與回答分兩次合成，再用 ffmpeg 串接並插入停頓。音檔只有問句與三個
回答，不唸 A、B、C 標籤，跟實際考試一致；作答時間由前端控制，不放進音檔。

用法：
    export TOEIC_BLOB_TOKEN='vercel_blob_rw_...'
    uv run scripts/build_listening_audio.py <questions.json>
    uv run scripts/build_listening_audio.py <questions.json> --force

需要 gcloud 已登入、Text-to-Speech API 已啟用，以及本機有 ffmpeg。
重跑會跳過已經上傳的題目，除非加 --force。
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

GCP_PROJECT = "dashai-490610"
TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
BLOB_API = "https://blob.vercel-storage.com"
BLOB_PREFIX = "part2/"

# 與單字音檔同一組聲音，voices 欄位用的就是這些 id
VOICES = {
    "us-f": ("en-US", "en-US-Neural2-F"),
    "us-m": ("en-US", "en-US-Neural2-D"),
    "gb-f": ("en-GB", "en-GB-Neural2-A"),
    "gb-m": ("en-GB", "en-GB-Neural2-B"),
    "au-f": ("en-AU", "en-AU-Neural2-A"),
    "au-m": ("en-AU", "en-AU-Neural2-B"),
}

# 問句與回答之間、回答與回答之間的停頓
GAP_SECONDS = 0.6
SPEAKING_RATE = 1.0


def gcloud_token() -> str:
    out = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


def synthesize(text: str, voice_id: str, token: str) -> bytes:
    language_code, voice_name = VOICES[voice_id]
    payload = json.dumps(
        {
            "input": {"text": text},
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


def make_silence(path: Path, seconds: float) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
            "-t", str(seconds), "-c:a", "libmp3lame", "-b:a", "32k",
            str(path),
        ],
        check=True,
    )


def concat(parts: list[Path], output: Path, workdir: Path) -> None:
    """用 concat demuxer 串接，再重新編碼一次讓時間軸乾淨。"""
    listing = workdir / "concat.txt"
    listing.write_text(
        "\n".join(f"file '{p.as_posix()}'" for p in parts) + "\n", encoding="utf-8"
    )
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(listing),
            "-c:a", "libmp3lame", "-b:a", "64k", "-ar", "24000", "-ac", "1",
            str(output),
        ],
        check=True,
    )


def blob_upload(pathname: str, data: bytes, token: str) -> str:
    request = urllib.request.Request(
        f"{BLOB_API}/{pathname}",
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "x-api-version": "7",
            "x-content-type": "audio/mpeg",
            "x-add-random-suffix": "0",
            "x-cache-control-max-age": "31536000",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)["url"]


def blob_list(token: str) -> set[str]:
    done: set[str] = set()
    cursor = None
    while True:
        params = {"prefix": BLOB_PREFIX, "limit": "1000"}
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


def build_question(question: dict, token: str, workdir: Path) -> bytes:
    voices = question.get("voices") or {}
    prompt_voice = voices.get("prompt", "us-f")
    response_voice = voices.get("responses", "gb-m")

    silence = workdir / "gap.mp3"
    make_silence(silence, GAP_SECONDS)

    parts: list[Path] = []
    prompt_file = workdir / "prompt.mp3"
    prompt_file.write_bytes(synthesize(question["prompt"], prompt_voice, token))
    parts.append(prompt_file)

    for index, option in enumerate(question["options"]):
        parts.append(silence)
        option_file = workdir / f"option_{index}.mp3"
        option_file.write_bytes(synthesize(option["text"], response_voice, token))
        parts.append(option_file)

    output = workdir / "joined.mp3"
    concat(parts, output, workdir)
    return output.read_bytes()


def main() -> int:
    parser = argparse.ArgumentParser(description="產生聽力 Part 2 音檔")
    parser.add_argument("questions", type=Path)
    parser.add_argument("--force", action="store_true", help="已存在的也重產")
    args = parser.parse_args()

    blob_token = os.environ.get("TOEIC_BLOB_TOKEN")
    if not blob_token:
        logger.error("請先設定 TOEIC_BLOB_TOKEN")
        return 1
    if not subprocess.run(["which", "ffmpeg"], capture_output=True).stdout:
        logger.error("找不到 ffmpeg")
        return 1

    questions = json.loads(args.questions.read_text(encoding="utf-8"))
    existing = set() if args.force else blob_list(blob_token)
    gcp_token = gcloud_token()

    done = 0
    total_bytes = 0
    failed: list[tuple[str, str]] = []

    for question in questions:
        pathname = f"{BLOB_PREFIX}{question['id']}.mp3"
        if pathname in existing:
            continue
        try:
            with tempfile.TemporaryDirectory() as tmp:
                audio = build_question(question, gcp_token, Path(tmp))
            blob_upload(pathname, audio, blob_token)
        except (urllib.error.HTTPError, urllib.error.URLError,
                subprocess.CalledProcessError, KeyError) as exc:
            failed.append((question["id"], str(exc)[:80]))
            continue
        done += 1
        total_bytes += len(audio)
        logger.info("  %s  %.0f KB", question["id"], len(audio) / 1024)

    logger.info("")
    logger.info("完成 %d 題，共 %.1f MB", done, total_bytes / 1048576)
    if failed:
        logger.warning("失敗 %d 題：", len(failed))
        for qid, reason in failed:
            logger.warning("  %s: %s", qid, reason)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
