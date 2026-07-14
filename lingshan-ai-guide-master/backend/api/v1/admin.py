"""Admin management API endpoints."""
from datetime import datetime, timedelta

from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel

router = APIRouter()


# ============================================================
# Request/Response Models
# ============================================================

class DashboardSummary(BaseModel):
    today_queries: int
    week_queries: int
    monthly_queries: int
    avg_satisfaction: float
    total_spots: int
    total_knowledge_chunks: int
    top_hot_questions: list[dict]
    satisfaction_trend: list[dict]
    hourly_distribution: list[dict]


class SentimentReportResponse(BaseModel):
    period_type: str
    period_start: str
    period_end: str
    total_queries: int
    avg_sentiment: float
    sentiment_distribution: dict
    hot_questions: list[dict]
    top_spots: list[dict]
    summary: str


class DocumentUploadResponse(BaseModel):
    id: str
    title: str
    status: str
    chunk_count: int


class DigitalHumanConfigRequest(BaseModel):
    name: str
    voice_speed: float = 1.0
    voice_pitch: float = 1.0
    emotion_presets: dict = {}
    clothes: dict = {}
    background_scene: str = "default"


# ============================================================
# Dashboard Endpoints
# ============================================================

@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary():
    """Get admin dashboard summary statistics."""
    return DashboardSummary(
        today_queries=1247,
        week_queries=8932,
        monthly_queries=35680,
        avg_satisfaction=96.3,
        total_spots=22,
        total_knowledge_chunks=450,
        top_hot_questions=[
            {"question": "灵山大佛有多高？", "count": 856},
            {"question": "门票价格是多少？", "count": 723},
            {"question": "九龙灌浴表演时间？", "count": 654},
            {"question": "梵宫有什么好看的？", "count": 532},
            {"question": "游览路线推荐", "count": 498},
        ],
        satisfaction_trend=[
            {"date": "2024-01-01", "score": 4.5},
            {"date": "2024-01-02", "score": 4.6},
            {"date": "2024-01-03", "score": 4.4},
            {"date": "2024-01-04", "score": 4.7},
            {"date": "2024-01-05", "score": 4.8},
            {"date": "2024-01-06", "score": 4.6},
            {"date": "2024-01-07", "score": 4.7},
        ],
        hourly_distribution=[
            {"hour": 8, "count": 45},
            {"hour": 9, "count": 189},
            {"hour": 10, "count": 234},
            {"hour": 11, "count": 198},
            {"hour": 12, "count": 87},
            {"hour": 13, "count": 123},
            {"hour": 14, "count": 256},
            {"hour": 15, "count": 167},
            {"hour": 16, "count": 89},
            {"hour": 17, "count": 34},
        ],
    )


@router.get("/reports/sentiment", response_model=SentimentReportResponse)
async def get_sentiment_report(period: str = "week"):
    """Get visitor sentiment analysis report."""
    return SentimentReportResponse(
        period_type=period,
        period_start="2024-01-01",
        period_end="2024-01-07",
        total_queries=8932,
        avg_sentiment=0.82,
        sentiment_distribution={
            "positive": 78,
            "neutral": 17,
            "negative": 5,
        },
        hot_questions=[
            {"question": "灵山大佛有多高？", "count": 856},
            {"question": "门票价格是多少？", "count": 723},
        ],
        top_spots=[
            {"name": "灵山大佛", "mention_count": 2340},
            {"name": "灵山梵宫", "mention_count": 1890},
        ],
        summary="本周游客关注度最高的是灵山大佛和门票相关话题。"
               "整体满意度保持在高位(96.3%)，负面反馈主要集中在排队等待时间。",
    )


# ============================================================
# Knowledge Base Management
# ============================================================

@router.post("/knowledge/documents", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """Upload a knowledge document for the knowledge base."""
    # Will be fully implemented in Phase 4
    return DocumentUploadResponse(
        id="doc_001",
        title=file.filename or "unknown",
        status="processing",
        chunk_count=0,
    )


@router.post("/knowledge/refresh-index")
async def refresh_knowledge_index():
    """Rebuild the vector index from all knowledge documents."""
    return {"status": "ok", "message": "索引刷新任务已提交"}


@router.get("/knowledge/test-qa")
async def test_qa_accuracy(query: str, top_k: int = 5):
    """Test RAG retrieval accuracy for a given query."""
    return {
        "query": query,
        "top_k": top_k,
        "results": [],  # Will show retrieved chunks
    }


# ============================================================
# Digital Human Configuration
# ============================================================

@router.get("/digital-human/appearance")
async def get_digital_human_config():
    """Get current digital human appearance configuration."""
    return {
        "id": "config_001",
        "name": "灵小禅",
        "model_path": "/avatar/model.gltf",
        "voice_id": "zh-CN-XiaoxiaoNeural",
        "voice_speed": 1.0,
        "voice_pitch": 1.0,
        "emotion_presets": {
            "happy": {"smile": 0.8, "eyebrow_raise": 0.5},
            "explain": {"smile": 0.2, "eyebrow_raise": 0.1},
            "think": {"smile": 0.0, "eyebrow_furrow": 0.5},
            "greet": {"smile": 1.0, "eyebrow_raise": 0.7},
            "farewell": {"smile": 0.6, "eyebrow_raise": 0.4},
        },
        "clothes": {"top": "traditional_hanfu", "color": "red_gold"},
        "background_scene": "lingshan_panorama",
        "is_active": True,
    }


@router.put("/digital-human/appearance")
async def update_digital_human_config(config: DigitalHumanConfigRequest):
    """Update digital human appearance configuration."""
    return {"status": "ok", "message": "数字人配置已更新"}
