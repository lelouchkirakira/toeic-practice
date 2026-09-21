import logging
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, Session
from ..config import DB_PATH, DATABASE_URL

logger = logging.getLogger(__name__)

engine = create_engine(DATABASE_URL, echo=False)


class TestSession(SQLModel, table=True):
    __tablename__ = 'test_sessions'

    id: Optional[int] = Field(default=None, primary_key=True)
    mode: str = Field(index=True)  # practice, mock
    part: str = Field(index=True)  # 5, 6, 7, mixed
    total_questions: int
    correct_count: int
    score: float
    time_spent_seconds: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.now)


class QuestionResult(SQLModel, table=True):
    __tablename__ = 'question_results'

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key='test_sessions.id', index=True)
    part: str
    question_id: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    grammar_category: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class WordProgress(SQLModel, table=True):
    __tablename__ = 'word_progress'

    id: Optional[int] = Field(default=None, primary_key=True)
    word_id: str = Field(index=True)
    level: str  # unknown, fuzzy, known
    review_count: int = Field(default=1)
    updated_at: datetime = Field(default_factory=datetime.now)


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)
    logger.info('資料庫初始化完成: %s', DB_PATH)


def get_session():
    with Session(engine) as session:
        yield session
