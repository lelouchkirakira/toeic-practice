#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["opencc-python-reimplemented"]
# ///
"""檢查單字庫品質：覆蓋率、簡體殘留、支語用詞。

用法：
    uv run scripts/check_vocabulary.py

禁用 Big5：不得用 Big5 可編碼性判斷字是不是正體中文。那是 1984 年的
字集，收字不全，正體字會被判成非正體，結論不可信。

簡體偵測的判準（試錯過幾次，記下來免得再踩）：

  OpenCC s2t 轉換    不能用。它把床、群、秘這類台灣標準字轉成
                    牀、羣、祕，六千筆會掃出近百筆假陽性。
  s2twp 冪等性      不能用。OpenCC 的詞組規則對已轉換的文字會重複
                    套用，「演算法」再轉一次會變成「演演算法」。
  STCharacters 左側  不能直接用。那張表是一對多對應，出→出/齣、
                    面→面/麵 這類簡繁同形字也在左側。

  可用：取 STCharacters 中「該字不在自己的繁體對應清單裡」的字。
  即使如此，OpenCC 以傳統繁體為正體，群、峰、床、灶這些台灣標準字
  仍會被它歸為簡體，所以這項只作資訊回報，不當成失敗條件。
"""

from __future__ import annotations

import collections
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = REPO_ROOT / 'backend/data/vocabulary/words.json'

# OpenCC 以傳統繁體為正體，這些字它歸為簡體，但教育部標準字體表與台灣實務都在用
TAIWAN_STANDARD = {
    '群',  # 群，異體為羣
    '床',  # 床，異體為牀
    '秘',  # 秘，異體為祕
    '峰',  # 峰，異體為峯
    '灶',  # 灶，異體為竈
    '痴',  # 痴，異體為癡
}

# 可判定的支語複合詞，出現即為錯
MAINLAND_TERMS = [
    '計算機輔助', '計算機竊賊', '一般水平', '同等水平', '競賽專案',
    '軟件', '信息', '視頻', '默認', '數據庫', '硬盤', '內存',
    '網絡', '服務器', '打印', '激光', '芯片', '鼠標', '兼容',
]

# 語意隨語境而異，列出來人工判讀，不自動判定為錯
CONTEXT_DEPENDENT = ['質量', '計算機', '程序', '水平', '優化', '渠道']


def simplified_only_set() -> set[str]:
    import opencc

    base = Path(opencc.__file__).parent / 'dictionary'
    mapping: dict[str, list[str]] = {}
    with (base / 'STCharacters.txt').open(encoding='utf-8') as fh:
        for line in fh:
            parts = line.rstrip('\n').split('\t')
            if len(parts) >= 2 and len(parts[0]) == 1:
                mapping[parts[0]] = parts[1].split(' ')
    return {char for char, variants in mapping.items() if char not in variants}


def main() -> int:
    if not WORDS_PATH.exists():
        print(f'找不到字庫檔: {WORDS_PATH}', file=sys.stderr)
        return 1

    words = json.loads(WORDS_PATH.read_text(encoding='utf-8'))
    total = len(words)
    failures = 0

    print(f'字庫 {WORDS_PATH.relative_to(REPO_ROOT)}')
    print(f'  headword        {total:6}')
    for field, label in [
        ('definition_en', '英文定義'),
        ('definition_zh', '中文釋義'),
        ('phonetic', '音標'),
    ]:
        filled = sum(1 for w in words if w.get(field))
        print(f'  {label:14}  {filled:6}  ({filled / total * 100:.1f}%)')
    filled = sum(1 for w in words if w.get('inflections'))
    print(f'  詞形變化        {filled:6}  ({filled / total * 100:.1f}%)')

    print('\n簡體專用字掃描')
    simplified = simplified_only_set() - TAIWAN_STANDARD
    hits: collections.Counter = collections.Counter()
    examples: dict[str, list[str]] = collections.defaultdict(list)
    for word in words:
        for char in word.get('definition_zh', ''):
            if char in simplified:
                hits[char] += 1
                if len(examples[char]) < 4:
                    examples[char].append(word['word'])
    if hits:
        print(f'  命中 {len(hits)} 種、共 {sum(hits.values())} 次（僅供判讀，不計入失敗）')
        for char, count in hits.most_common():
            print(f'    U+{ord(char):04X}  {count:4} 次  例: {", ".join(examples[char])}')
    else:
        print('  命中 0，通過')

    print('\n支語複合詞掃描')
    term_hits: collections.Counter = collections.Counter()
    for word in words:
        for term in MAINLAND_TERMS:
            if term in word.get('definition_zh', ''):
                term_hits[term] += 1
    if term_hits:
        failures += 1
        for term, count in term_hits.most_common():
            print(f'    {term}  {count} 筆')
    else:
        print('  命中 0，通過')

    print('\n需人工判讀的語境相關用詞')
    context_hits: dict[str, list[str]] = collections.defaultdict(list)
    for word in words:
        for term in CONTEXT_DEPENDENT:
            if term in word.get('definition_zh', ''):
                context_hits[term].append(word['word'])
    if context_hits:
        for term, hit_words in sorted(context_hits.items()):
            print(f'    {term}: {", ".join(hit_words[:8])}')
        print('  以上非錯誤，確認語境正確即可')
    else:
        print('  無')

    print()
    if failures:
        print(f'檢查未通過，{failures} 項有問題')
        return 1
    print('檢查通過')
    return 0


if __name__ == '__main__':
    sys.exit(main())
