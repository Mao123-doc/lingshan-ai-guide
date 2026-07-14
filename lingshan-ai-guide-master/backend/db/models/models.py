"""Database models for Ling Shan Tour Guide System."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, Boolean,
    ForeignKey, JSON, UniqueConstraint, Index,
)
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import relationship

from backend.db.session import Base


def generate_uuid():
    return str(uuid.uuid4())


class ScenicSpot(Base):
    """Scenic spot information from knowledge base."""
    __tablename__ = "scenic_spots"

    id = Column(String, primary_key=True, default=generate_uuid)
    spot_code = Column(String(10), unique=True, nullable=False, index=True)
    area_name = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)
    location = Column(Text)
    params = Column(Text)
    core_function = Column(Text)
    cultural_significance = Column(Text)
    description = Column(Text)
    highlights = Column(Text)
    opening_hours = Column(Text)
    notes = Column(Text)
    category = Column(String(50), index=True)
    image_url = Column(String(500))
    visit_duration = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeDocument(Base):
    """Admin-uploaded knowledge documents."""
    __tablename__ = "knowledge_documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(500), nullable=False)
    file_type = Column(String(20))
    file_path = Column(String(1000))
    content = Column(Text)
    chunk_count = Column(Integer, default=0)
    category = Column(String(100))
    status = Column(String(20), default="processing", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConversationLog(Base):
    """Record of visitor Q&A interactions."""
    __tablename__ = "conversation_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String(100), nullable=False, index=True)
    user_query = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    retrieved_chunks = Column(SQLiteJSON)
    llm_model = Column(String(100))
    sentiment = Column(String(20), index=True)
    sentiment_score = Column(Float)
    latency_ms = Column(Integer)
    user_rating = Column(Integer)
    feedback_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("idx_session_created", "session_id", "created_at"),
    )


class VisitorSession(Base):
    """Visitor interaction sessions."""
    __tablename__ = "visitor_sessions"

    id = Column(String(100), primary_key=True)
    interests = Column(SQLiteJSON)
    visit_duration = Column(Integer)
    query_count = Column(Integer, default=0)
    start_time = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow)


class AdminUser(Base):
    """Admin users for backend access."""
    __tablename__ = "admin_users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), default="admin")
    created_at = Column(DateTime, default=datetime.utcnow)


class SentimentReport(Base):
    """Pre-aggregated sentiment reports."""
    __tablename__ = "sentiment_reports"

    id = Column(String, primary_key=True, default=generate_uuid)
    period_type = Column(String(20))
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    total_queries = Column(Integer)
    avg_sentiment = Column(Float)
    sentiment_distribution = Column(SQLiteJSON)
    hot_questions = Column(SQLiteJSON)
    top_spots = Column(SQLiteJSON)
    summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("period_type", "period_start", name="uq_period"),
    )


class DigitalHumanConfig(Base):
    """Digital human appearance and behavior configuration."""
    __tablename__ = "digital_human_configs"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100))
    model_path = Column(String(1000))
    voice_id = Column(String(100))
    voice_speed = Column(Float, default=1.0)
    voice_pitch = Column(Float, default=1.0)
    emotion_presets = Column(SQLiteJSON)
    clothes = Column(SQLiteJSON)
    background_scene = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HotQuestion(Base):
    """Frequently asked questions cache."""
    __tablename__ = "hot_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_text = Column(Text, nullable=False)
    normalized_text = Column(Text, unique=True)
    query_count = Column(Integer, default=1)
    last_asked = Column(DateTime, default=datetime.utcnow)
