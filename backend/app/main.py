import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
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

from fastapi import Request

@app.middleware("http")
async def fix_toeic_path_middleware(request: Request, call_next):
    path = request.scope.get("path", "")
    while "//" in path:
        path = path.replace("//", "/")
    if path.startswith("/toeic/"):
        path = "/api/" + path[len("/toeic/"):]
    elif path == "/toeic":
        path = "/api"
    request.scope["path"] = path
    response = await call_next(request)
    return response
    
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
