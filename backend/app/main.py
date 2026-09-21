import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models.database import init_db
from .services.question_bank import question_bank
from .services.vocabulary import vocabulary
from .routers import quiz, stats, vocabulary as vocabulary_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    question_bank.load()
    logger.info('題庫狀態: %s', question_bank.get_status())
    vocabulary.load()
    logger.info('字庫狀態: %s', vocabulary.get_status())
    yield


app = FastAPI(
    title='TOEIC Practice',
    description='TOEIC 刷題練習系統',
    version='1.0.0',
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(quiz.router)
app.include_router(stats.router)
app.include_router(vocabulary_router.router)


@app.get('/')
async def root():
    return {
        'name': 'TOEIC Practice API',
        'version': '1.0.0',
        'endpoints': ['/api/quiz', '/api/stats', '/api/vocabulary']
    }


@app.get('/api/status')
async def status():
    return {
        'success': True,
        'data': {
            'question_bank': question_bank.get_status(),
            'vocabulary': vocabulary.get_status()
        }
    }
