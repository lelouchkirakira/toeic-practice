#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]>=3.2"]
# ///
"""把單字例句匯入 Neon 的 toeic_words.examples。

例句是寫給人看的學習內容，情境設定在辦公室、出差、訂位、商業書信這些
多益實際會考的場景。目標單字在英文句子裡用 **星號** 標出來，前端據此
highlight。

輸入檔是一個 JSON 陣列：

    [
      {
        "id": "w_00957",
        "word": "client",
        "examples": [
          {"en": "The **client** asked us to ...", "zh": "客戶要求我們..."}
        ]
      }
    ]

用法：
    export DATABASE_URL='postgresql://...'
    uv run scripts/import_examples.py path/to/examples.json

重跑安全：同一個 id 會覆蓋掉舊的例句，不會產生重複。
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def validate(entries: list[dict]) -> list[tuple[str, list[dict]]]:
    """擋掉格式不對的資料，免得壞內容進資料庫。"""
    rows: list[tuple[str, list[dict]]] = []
    for entry in entries:
        word_id = (entry.get("id") or "").strip()
        examples = entry.get("examples") or []
        if not word_id:
            logger.warning("  略過沒有 id 的項目: %s", str(entry)[:60])
            continue
        clean: list[dict] = []
        for example in examples:
            en = (example.get("en") or "").strip()
            zh = (example.get("zh") or "").strip()
            if not en or not zh:
                logger.warning("  %s 有不完整的例句，略過該句", word_id)
                continue
            clean.append({"en": en, "zh": zh})
        if clean:
            rows.append((word_id, clean))
    return rows


def main() -> int:
    if len(sys.argv) < 2:
        logger.error("用法: uv run scripts/import_examples.py <examples.json>")
        return 1

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("請先設定 DATABASE_URL")
        return 1

    path = Path(sys.argv[1])
    entries = json.loads(path.read_text(encoding="utf-8"))
    rows = validate(entries)
    if not rows:
        logger.error("沒有可匯入的資料")
        return 1

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE toeic_words SET examples = %s WHERE id = %s",
                [(Jsonb(examples), word_id) for word_id, examples in rows],
            )
            updated = cur.rowcount
        conn.commit()

        with conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) FROM toeic_words WHERE jsonb_array_length(examples) > 0"
            )
            total = (cur.fetchone() or [0])[0]

    logger.info("匯入 %d 筆例句", len(rows))
    logger.info("資料庫現有例句的單字數: %d", total)
    if updated != len(rows):
        logger.warning("有 %d 筆的 id 在字庫裡找不到", len(rows) - max(updated, 0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
