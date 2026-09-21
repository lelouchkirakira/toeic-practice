#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["opencc-python-reimplemented"]
# ///
"""建置多益單字庫。

字表來源為 New General Service List Project（CC BY-SA 4.0，可商用）：
  NGSL-GR 1.0  5,050 字  一般英語核心字
  TSL 1.2      1,250 字  多益專用字
  BSL 1.2      1,744 字  商業英語字
  NAWL 1.2       957 字  學術字
四表去重後 6,234 個 headword。

英文定義優先取官方 easy English 定義檔，不足的部分與全部中文釋義取自
ECDICT（MIT 授權），中文經 OpenCC s2twp 轉正體後再套補充替換表。

用法：
    uv run scripts/build_vocabulary.py
    uv run scripts/build_vocabulary.py --cache-dir /tmp/vocab-cache
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import logging
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

NGSL_BASE = 'https://www.newgeneralservicelist.com/s'
ECDICT_URL = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv'

# 字表檔：名稱 -> (檔名, headword 所在欄, rank 欄, band 欄)
WORD_LISTS = {
    'NGSL-GR': ('NGSL-GR_rank.csv', 1, 0, None),
    'TSL': ('TSL_12_stats.csv', 0, 1, None),
    'BSL': ('BSL_120_stats.csv', 0, 1, 2),
    'NAWL': ('NAWL_12_stats.csv', 0, 1, 2),
}

# 官方英文定義檔：檔名 -> (headword 欄, 定義欄)
DEFINITION_FILES = {
    'NGSL_12_with_English_definitions.xlsx': (0, 1),
    'TSL_12_definitions.xlsx': (0, 1),
    'NAWL_12_with_en_definitions.csv': (0, 1),
}

# 詞形變化檔
INFLECTION_FILES = [
    'NGSL_12_lemmatized_for_teaching.csv',
    'TSL_12_lemmatized_for_teaching.csv',
    'BSL_120_lemmatized_for_teaching.csv',
    'NAWL_12_lemmatized_for_teaching.csv',
]

# NGSL-GR 官方分級：前 8 band 各 400 字，後 3 band 各 600 字
BAND_BOUNDS = [400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3800, 4400, 5050]
BAND_OUTSIDE = 12  # 不在 NGSL-GR 的字歸為進階

# OpenCC s2twp 轉不掉的支語，語意無歧義者直接替換
TERM_FIXES = {
    '網絡': '網路',
    '服務器': '伺服器',
    '打印機': '印表機',
    '打印': '列印',
    '激光': '雷射',
    '芯片': '晶片',
    '內存': '記憶體',
    '硬盤': '硬碟',
    '光盤': '光碟',
    '鼠標': '滑鼠',
    '音頻': '音訊',
    '兼容': '相容',
    '集成電路': '積體電路',
    '筆記本電腦': '筆記型電腦',
    '出租車': '計程車',
    '公交車': '公車',
    '自行車': '腳踏車',
    '土豆': '馬鈴薯',
    '西紅柿': '番茄',
    '奶酪': '起司',
    '三文魚': '鮭魚',
    '金槍魚': '鮪魚',
    # s2twp 把「项目」一律轉成「專案」，但英漢釋義裡幾乎都是「項目」的語意
    '專案': '項目',
    # 「計算機」指 computer 時台灣說電腦，但數學語境的計算機不動，故只替換複合詞
    '計算機輔助': '電腦輔助',
    '計算機竊賊': '電腦竊賊',
    '計算機新技術': '電腦新技術',
    '(計算機)': '(電腦)',
    # 「水平」指程度時台灣說水準，幾何語境的水平線、水平面不動
    '一般水平': '一般水準',
    '同等水平': '同等水準',
    '才能, 質量': '才能',
    # 擬聲字，台灣寫法
    '咔': '喀',
}

# 語意隨語境而異，不自動替換，只列入報告供人工判讀
AMBIGUOUS_TERMS = ['質量', '計算機', '程序', '優化', '渠道', '水平']


USER_AGENT = 'toeic-practice-vocabulary-builder/1.0'


def fetch(url: str, dest: Path, retries: int = 4) -> Path:
    """下載檔案，已存在就沿用快取。字表主機會限流，失敗時退避重試。"""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    name = url.rsplit('/', 1)[-1]
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    for attempt in range(1, retries + 1):
        try:
            logger.info('下載 %s', name)
            tmp = dest.with_suffix(dest.suffix + '.part')
            with urllib.request.urlopen(request, timeout=180) as resp, tmp.open('wb') as fh:
                while chunk := resp.read(1 << 20):
                    fh.write(chunk)
            tmp.replace(dest)
            return dest
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == retries:
                raise
            wait = 5 * 2 ** (attempt - 1)
            logger.warning('  %s 被限流，%d 秒後重試', name, wait)
            time.sleep(wait)
    return dest


def read_csv_rows(path: Path) -> list[list[str]]:
    """部分字表檔是 cp1252 編碼（café、résumé 等借詞），UTF-8 讀失敗就退回。"""
    raw = path.read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('cp1252')
    return [row for row in csv.reader(text.splitlines()) if row]


def read_xlsx_rows(path: Path) -> list[list[str]]:
    """讀 xlsx，不引入額外套件。"""
    zf = zipfile.ZipFile(path)
    shared: list[str] = []
    if 'xl/sharedStrings.xml' in zf.namelist():
        xml = zf.read('xl/sharedStrings.xml').decode('utf-8', 'replace')
        shared = [
            html.unescape(re.sub(r'<[^>]+>', '', si))
            for si in re.findall(r'<si>(.*?)</si>', xml, re.S)
        ]
    sheet = zf.read('xl/worksheets/sheet1.xml').decode('utf-8', 'replace')
    rows = []
    for raw_row in re.findall(r'<row[^>]*>(.*?)</row>', sheet, re.S):
        cells = []
        for ctag, inner in re.findall(r'<c([^>]*)>(.*?)</c>', raw_row, re.S):
            ctype = re.search(r't="(\w+)"', ctag)
            ctype = ctype.group(1) if ctype else 'n'
            value = re.search(r'<v>(.*?)</v>', inner, re.S)
            if not value:
                cells.append('')
                continue
            raw = value.group(1)
            if ctype == 's' and raw.isdigit() and int(raw) < len(shared):
                cells.append(shared[int(raw)])
            else:
                cells.append(html.unescape(raw))
        rows.append(cells)
    return rows


def band_of(rank: int) -> int:
    for index, bound in enumerate(BAND_BOUNDS, start=1):
        if rank <= bound:
            return index
    return len(BAND_BOUNDS)


def collect_headwords(cache: Path) -> dict[str, dict]:
    """合併四份字表，回傳 headword -> 各表 rank 與 band。"""
    words: dict[str, dict] = {}
    for list_name, (filename, word_col, rank_col, band_col) in WORD_LISTS.items():
        path = fetch(f'{NGSL_BASE}/{filename}', cache / filename)
        rows = read_csv_rows(path)[1:]
        count = 0
        for row in rows:
            if len(row) <= max(word_col, rank_col):
                continue
            word = row[word_col].strip().lower()
            if not word:
                continue
            rank = row[rank_col].strip()
            entry = words.setdefault(word, {'lists': {}})
            meta = {'rank': int(rank)} if rank.isdigit() else {}
            if band_col is not None and len(row) > band_col and row[band_col].strip().isdigit():
                meta['band'] = int(row[band_col].strip())
            entry['lists'][list_name] = meta
            count += 1
        logger.info('  %-8s %5d 字', list_name, count)
    return words


def collect_definitions(cache: Path) -> dict[str, str]:
    """官方 easy English 定義。"""
    definitions: dict[str, str] = {}
    for filename, (word_col, def_col) in DEFINITION_FILES.items():
        path = fetch(f'{NGSL_BASE}/{filename}', cache / filename)
        rows = read_xlsx_rows(path) if filename.endswith('.xlsx') else read_csv_rows(path)
        added = 0
        for row in rows[1:]:
            if len(row) <= max(word_col, def_col):
                continue
            word = row[word_col].strip().lower()
            text = row[def_col].strip()
            if word and text and word not in definitions:
                definitions[word] = text
                added += 1
        logger.info('  %-42s %5d 條', filename, added)
    return definitions


def collect_inflections(cache: Path) -> dict[str, list[str]]:
    """官方詞形變化表。"""
    inflections: dict[str, list[str]] = {}
    for filename in INFLECTION_FILES:
        path = fetch(f'{NGSL_BASE}/{filename}', cache / filename)
        for row in read_csv_rows(path):
            if not row or row[0].startswith('#'):
                continue
            head = row[0].strip().lower()
            forms = [c.strip() for c in row[1:] if c.strip()]
            if head and forms:
                inflections.setdefault(head, forms)
    return inflections


def split_segments(raw: str) -> list[str]:
    """ECDICT 的換行在 CSV 內是字面的反斜線 n，要先還原再分段。"""
    text = raw.replace('\\n', '\n')
    return [seg.strip() for seg in text.split('\n') if seg.strip()]


def clean_translation(raw: str) -> str:
    """整理中文釋義：丟掉網路釋義，領域標籤段落降為備用。"""
    segments = [
        seg for seg in split_segments(raw)
        if not seg.startswith('[网络]') and not seg.startswith('[網絡]')
    ]
    plain = [seg for seg in segments if not re.match(r'^\[[^\]]+\]', seg)]
    return '; '.join(plain or segments)[:200]


def clean_definition(raw: str) -> str:
    return ' '.join(split_segments(raw))[:300]


def parse_pos(raw: str) -> str:
    """ECDICT pos 欄格式為 n:64/v:36，取占比最高者。"""
    if not raw:
        return ''
    best, best_score = '', -1
    for part in raw.split('/'):
        if ':' not in part:
            continue
        tag, _, score = part.partition(':')
        if score.strip().isdigit() and int(score) > best_score:
            best, best_score = tag.strip(), int(score)
    return best


def deaccent(word: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFKD', word) if not unicodedata.combining(c)
    )


def normalize_key(word: str) -> str:
    """拼法正規化：ECDICT 與字表對同一個詞的連字號、空格、重音處理不一致。"""
    return deaccent(word).replace('-', '').replace(' ', '').replace('.', '')


def entry_of(row: dict) -> dict:
    return {
        'phonetic': (row.get('phonetic') or '').strip(),
        'definition': clean_definition(row.get('definition') or ''),
        'translation': clean_translation(row.get('translation') or ''),
        'pos': parse_pos((row.get('pos') or '').strip()),
    }


def load_ecdict(path: Path, wanted: set[str]) -> dict[str, dict]:
    """從 ECDICT 抽出需要的字。精確拼法優先，其餘用正規化後的拼法補。"""
    variants: dict[str, list[str]] = {}
    for word in wanted:
        variants.setdefault(normalize_key(word), []).append(word)

    found: dict[str, dict] = {}
    by_variant: dict[str, dict] = {}
    with path.open(encoding='utf-8', errors='replace', newline='') as fh:
        for row in csv.DictReader(fh):
            raw_word = (row.get('word') or '').strip().lower()
            if not raw_word:
                continue
            if raw_word in wanted and raw_word not in found:
                found[raw_word] = entry_of(row)
            key = normalize_key(raw_word)
            if key in variants and key not in by_variant:
                by_variant[key] = entry_of(row)

    for key, targets in variants.items():
        if key in by_variant:
            for target in targets:
                found.setdefault(target, by_variant[key])
    return found


def to_traditional(text: str, converter) -> str:
    if not text:
        return ''
    converted = converter.convert(text)
    for wrong, right in TERM_FIXES.items():
        converted = converted.replace(wrong, right)
    return converted


def build(output: Path, cache: Path, use_ecdict: bool = True) -> int:
    import opencc

    logger.info('合併字表')
    words = collect_headwords(cache)
    logger.info('去重後 %d 個 headword\n', len(words))

    logger.info('讀取官方英文定義')
    official_definitions = collect_definitions(cache)
    inflections = collect_inflections(cache)
    logger.info('')

    if use_ecdict:
        logger.info('讀取 ECDICT（首次執行需下載 63 MB）')
        ecdict_path = fetch(ECDICT_URL, cache / 'ecdict.csv')
        ecdict = load_ecdict(ecdict_path, set(words))
        logger.info('  命中 %d / %d 字\n', len(ecdict), len(words))
    else:
        ecdict = {}
        logger.info('跳過 ECDICT，本次不產中文釋義與音標\n')

    converter = opencc.OpenCC('s2twp')
    entries = []
    stats = Counter()
    suspect: list[tuple[str, str, str]] = []

    for index, (word, meta) in enumerate(sorted(words.items()), start=1):
        source = ecdict.get(word, {})
        definition_en = official_definitions.get(word) or source.get('definition', '')
        definition_zh = to_traditional(source.get('translation', ''), converter)

        stats['official_def'] += 1 if word in official_definitions else 0
        stats['ecdict_def'] += 1 if word not in official_definitions and definition_en else 0
        stats['no_def'] += 0 if definition_en else 1
        stats['no_zh'] += 0 if definition_zh else 1

        for term in AMBIGUOUS_TERMS:
            if term in definition_zh:
                suspect.append((word, term, definition_zh))
                break

        gr_rank = meta['lists'].get('NGSL-GR', {}).get('rank')
        entries.append({
            'id': f'w_{index:05d}',
            'word': word,
            'pos': source.get('pos', ''),
            'phonetic': source.get('phonetic', ''),
            'definition_en': definition_en,
            'definition_zh': definition_zh,
            'lists': meta['lists'],
            'band': band_of(gr_rank) if gr_rank else BAND_OUTSIDE,
            'inflections': inflections.get(word, []),
        })

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(entries, ensure_ascii=False, indent=1),
        encoding='utf-8',
    )

    total = len(entries)
    logger.info('產出 %s', output)
    logger.info('  headword            %5d', total)
    logger.info('  官方英文定義        %5d (%.1f%%)', stats['official_def'], stats['official_def'] / total * 100)
    logger.info('  ECDICT 補英文定義   %5d', stats['ecdict_def'])
    logger.info('  仍缺英文定義        %5d', stats['no_def'])
    logger.info('  缺中文釋義          %5d', stats['no_zh'])
    logger.info('  疑似支語待人工判讀  %5d', len(suspect))

    if suspect:
        report = output.parent / 'suspect_terms.txt'
        report.write_text(
            '\n'.join(f'{w}\t{term}\t{text}' for w, term, text in suspect),
            encoding='utf-8',
        )
        logger.info('  報告 %s', report)

    return total


def main() -> int:
    parser = argparse.ArgumentParser(description='建置多益單字庫')
    repo_root = Path(__file__).resolve().parent.parent
    parser.add_argument(
        '--output',
        type=Path,
        default=repo_root / 'backend/data/vocabulary/words.json',
    )
    parser.add_argument(
        '--cache-dir',
        type=Path,
        default=repo_root / '.cache/vocabulary',
    )
    parser.add_argument(
        '--no-ecdict',
        action='store_true',
        help='跳過 ECDICT，只產英文定義版本',
    )
    args = parser.parse_args()

    total = build(args.output, args.cache_dir, use_ecdict=not args.no_ecdict)
    return 0 if total else 1


if __name__ == '__main__':
    sys.exit(main())
