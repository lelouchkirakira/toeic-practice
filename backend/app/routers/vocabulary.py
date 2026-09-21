from datetime import datetime
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from ..models.database import engine, WordProgress
from ..services.vocabulary import vocabulary, LIST_NAMES, LEVELS

router = APIRouter(prefix='/api/vocabulary', tags=['vocabulary'])

# 熟練度篩選：new 未學、learning 學習中（不會或模糊）、known 已熟
PROGRESS_FILTERS = ('new', 'learning', 'known')

MAX_WORD_COUNT = 200
MAX_QUIZ_COUNT = 50


class ProgressRequest(BaseModel):
    word_id: str
    level: str


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={'success': False, 'data': None, 'error': {'code': code, 'message': message}}
    )


def _unavailable() -> JSONResponse:
    return _error(503, 'VOCABULARY_UNAVAILABLE', '字庫尚未載入，暫時無法提供單字')


def _invalid_list() -> JSONResponse:
    return _error(400, 'INVALID_LIST', '字表只接受 ' + '、'.join(LIST_NAMES))


def _empty_bucket() -> dict:
    bucket = {level: 0 for level in LEVELS}
    bucket['total'] = 0
    return bucket


def _load_levels() -> dict[str, str]:
    with Session(engine) as session:
        rows = session.exec(select(WordProgress)).all()
    return {row.word_id: row.level for row in rows}


@router.get('/words')
async def get_words(
    list_name: str | None = Query(None, alias='list'),
    band: int | None = None,
    band_min: int | None = None,
    band_max: int | None = None,
    level: str | None = None,
    count: int = 20,
):
    if not vocabulary.is_ready():
        return _unavailable()
    if list_name and list_name not in LIST_NAMES:
        return _invalid_list()
    if level and level not in PROGRESS_FILTERS:
        return _error(400, 'INVALID_LEVEL', '熟練度只接受 ' + '、'.join(PROGRESS_FILTERS))

    count = max(1, min(count, MAX_WORD_COUNT))
    pool = vocabulary.filter_words(
        list_name=list_name, band=band, band_min=band_min, band_max=band_max
    )

    if level:
        known_levels = _load_levels()
        if level == 'new':
            pool = [w for w in pool if w['id'] not in known_levels]
        elif level == 'learning':
            pool = [w for w in pool if known_levels.get(w['id']) in ('unknown', 'fuzzy')]
        else:
            pool = [w for w in pool if known_levels.get(w['id']) == 'known']

    return {'success': True, 'data': vocabulary.sample(pool, count)}


@router.get('/quiz')
async def get_quiz(
    count: int = 10,
    band: int | None = None,
    list_name: str | None = Query(None, alias='list'),
):
    if not vocabulary.is_ready():
        return _unavailable()
    if list_name and list_name not in LIST_NAMES:
        return _invalid_list()

    count = max(1, min(count, MAX_QUIZ_COUNT))
    questions = vocabulary.get_quiz(count=count, band=band, list_name=list_name)
    return {'success': True, 'data': questions}


@router.post('/progress')
async def save_progress(req: ProgressRequest):
    if not vocabulary.is_ready():
        return _unavailable()
    if req.level not in LEVELS:
        return _error(400, 'INVALID_LEVEL', '熟練度只接受 ' + '、'.join(LEVELS))
    if vocabulary.get_word(req.word_id) is None:
        return _error(404, 'WORD_NOT_FOUND', f'字庫查無此單字: {req.word_id}')

    with Session(engine) as session:
        record = session.exec(
            select(WordProgress).where(WordProgress.word_id == req.word_id)
        ).first()
        if record is None:
            record = WordProgress(word_id=req.word_id, level=req.level)
        else:
            record.level = req.level
            record.review_count += 1
            record.updated_at = datetime.now()
        session.add(record)
        session.commit()
        session.refresh(record)
        data = {
            'word_id': record.word_id,
            'level': record.level,
            'review_count': record.review_count,
            'updated_at': record.updated_at.isoformat(),
        }

    return {'success': True, 'data': data}


@router.get('/progress/summary')
async def get_progress_summary():
    if not vocabulary.is_ready():
        return _unavailable()

    with Session(engine) as session:
        rows = session.exec(select(WordProgress)).all()

    by_level = {level: 0 for level in LEVELS}
    by_band: dict[str, dict] = {}
    by_list: dict[str, dict] = {name: _empty_bucket() for name in LIST_NAMES}
    total_reviews = 0

    for row in rows:
        word = vocabulary.get_word(row.word_id)
        if word is None or row.level not in LEVELS:
            continue
        total_reviews += row.review_count
        by_level[row.level] += 1

        band_key = str(word.get('band', 0))
        band_bucket = by_band.setdefault(band_key, _empty_bucket())
        band_bucket[row.level] += 1
        band_bucket['total'] += 1

        for name in (word.get('lists') or {}):
            if name in by_list:
                by_list[name][row.level] += 1
                by_list[name]['total'] += 1

    return {
        'success': True,
        'data': {
            'total_tracked': sum(by_level.values()),
            'total_reviews': total_reviews,
            'by_level': by_level,
            'by_band': dict(sorted(by_band.items(), key=lambda kv: int(kv[0]))),
            'by_list': by_list,
        }
    }
