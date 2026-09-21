#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]>=3.2"]
# ///
"""把字庫與題庫匯入 Neon。

字庫 words.json 衍生自 CC BY-SA 4.0 的字表，不進任何 proprietary repo，
所以改存資料庫，由 dashai-go 的 toeic module 讀取。

用法：
    export DATABASE_URL='postgresql://...'
    uv run scripts/import_to_neon.py

重跑是安全的：兩張內容表都以 upsert 寫入，不會產生重複列，
也不會動到 session / progress 那幾張累積資料的表。
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = REPO_ROOT / 'backend/data/vocabulary/words.json'
QUESTION_BANK_DIR = REPO_ROOT / 'backend/data/question_bank'
PARTS = ('part5', 'part6', 'part7')
BATCH = 500


def import_words(conn: psycopg.Connection) -> int:
    if not WORDS_PATH.exists():
        logger.error('找不到字庫: %s', WORDS_PATH)
        logger.error('先跑 uv run scripts/build_vocabulary.py')
        raise SystemExit(1)

    words = json.loads(WORDS_PATH.read_text(encoding='utf-8'))
    rows = [
        (
            w['id'],
            w['word'],
            w.get('pos') or '',
            w.get('phonetic') or '',
            w.get('definition_en') or '',
            w.get('definition_zh') or '',
            Jsonb(w.get('lists') or {}),
            int(w.get('band') or 12),
            list(w.get('inflections') or []),
        )
        for w in words
    ]

    sql = """
        INSERT INTO toeic_words
            (id, word, pos, phonetic, definition_en, definition_zh, lists, band, inflections)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            word = EXCLUDED.word,
            pos = EXCLUDED.pos,
            phonetic = EXCLUDED.phonetic,
            definition_en = EXCLUDED.definition_en,
            definition_zh = EXCLUDED.definition_zh,
            lists = EXCLUDED.lists,
            band = EXCLUDED.band,
            inflections = EXCLUDED.inflections
    """
    with conn.cursor() as cur:
        for start in range(0, len(rows), BATCH):
            cur.executemany(sql, rows[start:start + BATCH])
            logger.info('  單字 %d / %d', min(start + BATCH, len(rows)), len(rows))
    return len(rows)


def import_questions(conn: psycopg.Connection) -> int:
    total = 0
    sql = """
        INSERT INTO toeic_questions (id, part, payload)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            part = EXCLUDED.part,
            payload = EXCLUDED.payload
    """
    with conn.cursor() as cur:
        for part in PARTS:
            path = QUESTION_BANK_DIR / f'{part}.json'
            if not path.exists():
                logger.warning('  題庫不存在，略過: %s', path.name)
                continue
            items = json.loads(path.read_text(encoding='utf-8'))
            part_number = part.removeprefix('part')
            rows = [(item['id'], part_number, Jsonb(item)) for item in items]
            cur.executemany(sql, rows)
            logger.info('  Part %s: %d 組', part_number, len(rows))
            total += len(rows)
    return total


def main() -> int:
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        logger.error('請先設定 DATABASE_URL 環境變數')
        return 1

    with psycopg.connect(database_url) as conn:
        logger.info('匯入字庫')
        word_count = import_words(conn)
        logger.info('匯入題庫')
        question_count = import_questions(conn)
        conn.commit()

        with conn.cursor() as cur:
            cur.execute('SELECT count(*) FROM toeic_words')
            words_in_db = (cur.fetchone() or [0])[0]
            cur.execute('SELECT count(*) FROM toeic_questions')
            questions_in_db = (cur.fetchone() or [0])[0]

    logger.info('')
    logger.info('完成')
    logger.info('  toeic_words      寫入 %5d，資料庫現有 %5d', word_count, words_in_db)
    logger.info('  toeic_questions  寫入 %5d，資料庫現有 %5d', question_count, questions_in_db)
    return 0


if __name__ == '__main__':
    sys.exit(main())
