import json
import random
import logging
from ..config import DATA_DIR

logger = logging.getLogger(__name__)

VOCABULARY_DIR = DATA_DIR / 'vocabulary'
WORDS_PATH = VOCABULARY_DIR / 'words.json'

# 四份來源字表，名稱與 words.json 的 lists 鍵一致
LIST_NAMES = ('NGSL-GR', 'TSL', 'BSL', 'NAWL')

# 熟練度三級
LEVELS = ('unknown', 'fuzzy', 'known')

# 抽干擾選項時最多掃描幾筆候選字
DISTRACTOR_SCAN_LIMIT = 80

# 釋義當題幹或選項時的字數上限
QUIZ_TEXT_MAX = 24


def definition_of(word: dict) -> str:
    """取單字的顯示用釋義：有正體中文釋義優先，否則退回英文定義，都沒有就回空字串。"""
    zh = (word.get('definition_zh') or '').strip()
    if zh:
        return zh
    return (word.get('definition_en') or '').strip()


def quiz_text(definition: str) -> str:
    """釋義要當題幹或選項時只取第一個詞性段落再截短。

    完整釋義動輒六十幾個字，四個選項並排會爆版，而且正解往往是最長的那個，
    光比長度就能猜到答案。截到同樣長度可以一起解掉這兩個問題。
    """
    text = definition.split(';')[0].strip() or definition.strip()
    if len(text) > QUIZ_TEXT_MAX:
        text = text[:QUIZ_TEXT_MAX].rstrip() + '…'
    return text


class VocabularyService:

    def __init__(self):
        self._words: list[dict] = []
        self._by_id: dict[str, dict] = {}
        self._by_band: dict[int, list[dict]] = {}
        self._list_counts: dict[str, int] = {}
        self._loaded = False

    def load(self):
        if not WORDS_PATH.exists():
            logger.warning('字庫檔案不存在: %s', WORDS_PATH)
            return
        try:
            data = json.loads(WORDS_PATH.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            logger.error('載入字庫失敗: %s', e)
            return
        if not isinstance(data, list):
            logger.error('字庫格式錯誤，預期為陣列: %s', WORDS_PATH)
            return

        self._words = data
        self._by_id = {w['id']: w for w in data}
        self._by_band = {}
        for w in data:
            self._by_band.setdefault(w.get('band', 0), []).append(w)
        self._list_counts = {
            name: sum(1 for w in data if name in (w.get('lists') or {}))
            for name in LIST_NAMES
        }
        self._loaded = True
        logger.info('載入字庫: %d 筆', len(self._words))

    def is_ready(self) -> bool:
        return self._loaded and bool(self._words)

    def get_word(self, word_id: str) -> dict | None:
        return self._by_id.get(word_id)

    def filter_words(
        self,
        list_name: str | None = None,
        band: int | None = None,
        band_min: int | None = None,
        band_max: int | None = None,
    ) -> list[dict]:
        """依字表與難度篩出候選字。band 指定單一級別，band_min 與 band_max 指定區間。"""
        if band is not None:
            pool = self._by_band.get(band, [])
        else:
            pool = self._words
            if band_min is not None:
                pool = [w for w in pool if w.get('band', 0) >= band_min]
            if band_max is not None:
                pool = [w for w in pool if w.get('band', 0) <= band_max]
        if list_name:
            pool = [w for w in pool if list_name in (w.get('lists') or {})]
        return pool

    def sample(self, pool: list[dict], count: int) -> list[dict]:
        if not pool:
            return []
        return random.sample(pool, min(count, len(pool)))

    def get_words(
        self,
        list_name: str | None = None,
        band: int | None = None,
        count: int = 20,
        band_min: int | None = None,
        band_max: int | None = None,
    ) -> list[dict]:
        pool = self.filter_words(
            list_name=list_name, band=band, band_min=band_min, band_max=band_max
        )
        return self.sample(pool, count)

    def get_quiz(
        self,
        count: int = 10,
        band: int | None = None,
        list_name: str | None = None,
    ) -> list[dict]:
        """產生四選一單字題。前半出中譯英，後半出英譯中；中文釋義從缺就退回英譯中。"""
        pool = [w for w in self.filter_words(list_name=list_name, band=band) if definition_of(w)]
        if not pool:
            return []

        picked = self.sample(pool, count)
        half = len(picked) // 2
        questions = []
        for i, word in enumerate(picked):
            has_zh = bool((word.get('definition_zh') or '').strip())
            question = None
            if i < half and has_zh:
                question = self._build_definition_to_word(word)
            if question is None:
                question = self._build_word_to_definition(word)
            if question is not None:
                questions.append(question)
        return questions

    def get_status(self) -> dict:
        return {
            'loaded': self._loaded,
            'total': len(self._words),
            'with_definition': sum(1 for w in self._words if definition_of(w)),
            'bands': sorted(self._by_band.keys()),
            'lists': dict(self._list_counts),
        }

    def _distractor_pool(self, word: dict) -> list[dict]:
        """干擾選項優先取同 band，同 band 不夠才退回整個字庫。"""
        pool = [w for w in self._by_band.get(word.get('band', 0), []) if definition_of(w)]
        if len(pool) < 4:
            pool = [w for w in self._words if definition_of(w)]
        return pool

    def _pick_distractors(self, word: dict, answer: str, use_word_text: bool) -> list[str]:
        pool = self._distractor_pool(word)
        used = {answer}
        picked: list[str] = []
        for cand in self.sample(pool, DISTRACTOR_SCAN_LIMIT):
            if cand['id'] == word['id']:
                continue
            text = cand['word'] if use_word_text else quiz_text(definition_of(cand))
            if not text or text in used:
                continue
            used.add(text)
            picked.append(text)
            if len(picked) == 3:
                break
        return picked

    def _build_word_to_definition(self, word: dict) -> dict | None:
        answer = quiz_text(definition_of(word))
        if not answer:
            return None
        distractors = self._pick_distractors(word, answer, use_word_text=False)
        if len(distractors) < 3:
            return None
        return self._compose(word, f"{word['word']} 的意思是？", answer, distractors)

    def _build_definition_to_word(self, word: dict) -> dict | None:
        prompt = quiz_text((word.get('definition_zh') or '').strip())
        if not prompt:
            return None
        answer = word['word']
        distractors = self._pick_distractors(word, answer, use_word_text=True)
        if len(distractors) < 3:
            return None
        return self._compose(word, f'「{prompt}」是哪一個單字？', answer, distractors)

    def _compose(self, word: dict, sentence: str, answer: str, distractors: list[str]) -> dict:
        options = distractors + [answer]
        random.shuffle(options)
        return {
            'id': word['id'],
            'sentence': sentence,
            'options': options,
            'answer': answer,
            'explanation': self._explanation(word),
            'word': word['word'],
            'band': word.get('band'),
        }

    def _explanation(self, word: dict) -> str:
        """答題後顯示的完整釋義，空欄位一律略過不留佔位。"""
        head = word['word']
        phonetic = (word.get('phonetic') or '').strip()
        if phonetic:
            head += f' [{phonetic}]'
        pos = (word.get('pos') or '').strip()
        if pos:
            head += f' ({pos})'

        meanings = [
            m for m in (
                (word.get('definition_zh') or '').strip(),
                (word.get('definition_en') or '').strip(),
            ) if m
        ]
        if meanings:
            head += '：' + '；'.join(meanings)

        inflections = word.get('inflections') or []
        if inflections:
            head += '；詞形變化：' + '、'.join(inflections)
        return head


vocabulary = VocabularyService()
