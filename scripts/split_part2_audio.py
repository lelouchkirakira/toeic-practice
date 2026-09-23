#!/usr/bin/env python3
"""把 Part 2 的整段音檔切成問句與三個回答，另外產 A B C 三個字母音檔。

原本一題是一個檔：問句、停頓、回答一、停頓、回答二、停頓、回答三。
要在回答前面唸出字母、以及每次打亂回答順序，得先把回答拆成各自的檔。

切的是現有檔案，不重新合成任何一句話。唯一新合成的是三個字母，
一次產完所有題目共用。

輸出放在 web/public/audio/，跟著網站一起部署：
    part2/<題號>/q.mp3 1.mp3 2.mp3 3.mp3
    letters/a.mp3 b.mp3 c.mp3

需要 ffmpeg，以及 gcloud 已登入（產字母用）。
"""
from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

BLOB_BASE = "https://sp1vz5mua9vmz9jf.public.blob.vercel-storage.com"
BANK = Path("backend/data/question_bank")
OUT = Path("web/public/audio")
TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
GCP_PROJECT = "dashai-490610"
LETTER_VOICE = ("en-US", "en-US-Neural2-F")
# 靜音偵測門檻。建檔腳本插的是固定 0.6 秒靜音，實測偵測到約 1 秒（含語音尾巴）。
SILENCE_DB = "-40dB"
SILENCE_MIN = 0.6
PAD = 0.04


def part2_questions() -> list[dict]:
    """題目資料不在 repo 的 JSON 裡，改打線上 API 拿完整清單。"""
    url = "https://toeic.seikai.dev/api/backend/toeic/listening/questions?part=2&count=25"
    with urllib.request.urlopen(url) as response:
        return json.load(response)["data"]["questions"]


def silences(path: Path) -> list[tuple[float, float]]:
    result = subprocess.run(
        ["ffmpeg", "-i", str(path), "-af", f"silencedetect=noise={SILENCE_DB}:d={SILENCE_MIN}", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", result.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", result.stderr)]
    return list(zip(starts, ends))


def duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def cut(source: Path, start: float, end: float | None, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(source), "-ss", f"{max(0.0, start):.3f}"]
    if end is not None:
        cmd += ["-to", f"{end:.3f}"]
    cmd += ["-acodec", "libmp3lame", "-b:a", "64k", str(target)]
    subprocess.run(cmd, check=True)


def gcloud_token() -> str:
    return subprocess.run(
        ["gcloud", "auth", "print-access-token"], capture_output=True, text=True, check=True
    ).stdout.strip()


def synthesize_letter(letter: str, token: str) -> bytes:
    # 用 SSML 逐字唸，免得 A 被唸成冠詞。
    payload = json.dumps(
        {
            "input": {"ssml": f'<speak><say-as interpret-as="characters">{letter}</say-as></speak>'},
            "voice": {"languageCode": LETTER_VOICE[0], "name": LETTER_VOICE[1]},
            "audioConfig": {"audioEncoding": "MP3"},
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
        return base64.b64decode(json.load(response)["audioContent"])


def main() -> int:
    questions = part2_questions()
    print(f"Part 2 共 {len(questions)} 題")
    failed = []
    with tempfile.TemporaryDirectory() as tmp:
        for q in questions:
            source = Path(tmp) / f"{q['id']}.mp3"
            urllib.request.urlretrieve(f"{BLOB_BASE}/{q['audio']}", source)
            gaps = silences(source)
            if len(gaps) != 3:
                failed.append((q["id"], len(gaps)))
                continue
            folder = OUT / "part2" / q["id"]
            (s1, e1), (s2, e2), (s3, e3) = gaps
            cut(source, 0, s1 + PAD, folder / "q.mp3")
            cut(source, e1 - PAD, s2 + PAD, folder / "1.mp3")
            cut(source, e2 - PAD, s3 + PAD, folder / "2.mp3")
            cut(source, e3 - PAD, None, folder / "3.mp3")
            parts = [duration(folder / f"{n}.mp3") for n in ("q", "1", "2", "3")]
            print(f"  {q['id']}  問句 {parts[0]:.1f}s  回答 {parts[1]:.1f}s {parts[2]:.1f}s {parts[3]:.1f}s")

    if failed:
        print("\n靜音段數不是 3，沒切：")
        for qid, count in failed:
            print(f"  {qid}：偵測到 {count} 段")

    token = gcloud_token()
    letters = OUT / "letters"
    letters.mkdir(parents=True, exist_ok=True)
    for letter in "ABC":
        (letters / f"{letter.lower()}.mp3").write_bytes(synthesize_letter(letter, token))
        print(f"  字母 {letter}：{duration(letters / f'{letter.lower()}.mp3'):.2f}s")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
