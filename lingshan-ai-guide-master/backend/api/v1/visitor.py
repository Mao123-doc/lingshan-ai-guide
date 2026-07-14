"""Visitor-facing API endpoints."""
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from backend.db.session import get_db

router = APIRouter()


# ============================================================
# Request/Response Models
# ============================================================

class QARequest(BaseModel):
    query: str = Field(..., description="用户问题")
    session_id: str = Field(default="", description="会话ID")


SPOT_IMAGES = {
    "灵山大佛": "lingshan_dafo.jpg",
    "九龙灌浴": "jiulong_guanyu.jpg",
    "灵山梵宫": "lingshan_fangong.jpg",
    "五印坛城": "wuyin_tancheng.jpg",
    "祥符禅寺": "xiangfu_temple.jpg",
    "拈花湾": "nianhua_wan.jpg",
    "五明桥": "wuming_bridge.jpg",
    "胜境门楼": "shengjing_gate.jpg",
    "洗心池": "xixin_pond.jpg",
    "佛足坛": "fozu_altar.jpg",
    "降魔浮雕": "xiangmo_relief.jpg",
    "阿育王柱": "ayuwang_pillar.jpg",
    "天下第一掌": "tianxiadiyizhang.jpg",
    "百子戏弥勒": "baiziximile.jpg",
    "杏坛广场": "xingtan_square.jpg",
    "登云道": "dengyun_road.jpg",
    "灵山大照壁": "lingshan_zhaobi.jpg",
    "梵宫珍宝馆": "zhenbao_hall.jpg",
    "曼飞龙塔": "manfeilong_pagoda.jpg",
    "佛手樟": "foshou_zhang.jpg",
    "六角井": "liujiao_well.jpg",
    "白莲池": "bailian_pond.jpg",
    "五智门": "wuzhi_gate.jpg",
    "菩提大道": "puti_avenue.jpg",
    "佛教文化博览馆": "fojiao_museum.jpg",
    "拈花广场": "nianhua_square.jpg",
    "梵天花海": "fantian_huahai.jpg",
    "香悦花街": "xiangyue_street.jpg",
    "拈花堂": "nianhua_hall.jpg",
    "五湖灯": "wuhu_lamp.jpg",
    "鹿鸣谷": "luming_valley.jpg",
}


class QAResponse(BaseModel):
    answer: str
    session_id: str
    sources: list[dict] = []
    emotion: str = "neutral"
    related_spots: list[str] = []
    image_urls: list[dict] = []


class RecommendRequest(BaseModel):
    interests: list[str] = Field(default=[], description="兴趣标签")
    duration: int = Field(default=4, description="预计游览时间(小时)")


class RecommendItem(BaseModel):
    spot_id: str
    name: str
    reason: str
    visit_duration: int


class RecommendResponse(BaseModel):
    route: list[RecommendItem]
    total_duration: int
    tips: str


class FeedbackRequest(BaseModel):
    session_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""


class SessionInitResponse(BaseModel):
    session_id: str
    welcome_message: str


class SpotResponse(BaseModel):
    id: str
    name: str
    area_name: str
    category: str
    summary: str
    highlight: str


class SpotDetailResponse(BaseModel):
    id: str
    spot_code: str
    area_name: str
    name: str
    location: str
    params: str
    core_function: str
    cultural_significance: str
    description: str
    highlights: str
    opening_hours: str
    notes: str
    category: str


# ============================================================
# API Endpoints
# ============================================================

@router.get("/spots", response_model=list[SpotResponse])
async def list_spots(
    category: str = "all",
    area: str = "all",
    db: AsyncSession = Depends(get_db),
):
    """List all scenic spots with optional filtering."""
    # Return mock data for now - will be connected to DB in Phase 2
    spots = [
        SpotResponse(
            id="1",
            name="灵山大佛",
            area_name="灵山胜境",
            category="佛教建筑",
            summary="世界最高露天青铜释迦牟尼立像，通高88米",
            highlight="登顶抱佛脚，俯瞰太湖全景",
        ),
        SpotResponse(
            id="2",
            name="九龙灌浴",
            area_name="灵山胜境",
            category="动态景观",
            summary="大型音乐动态群雕，再现佛陀诞生祥瑞场景",
            highlight="花开见佛，九龙吐水",
        ),
        SpotResponse(
            id="3",
            name="灵山梵宫",
            area_name="灵山胜境",
            category="佛教建筑",
            summary="被誉为'东方卢浮宫'的佛教艺术殿堂",
            highlight="穹顶天象图，《华藏世界》琉璃壁画",
        ),
        SpotResponse(
            id="4",
            name="五印坛城",
            area_name="灵山胜境",
            category="藏传佛教",
            summary="藏传佛教风格建筑，有'小布达拉宫'之称",
            highlight="转经筒祈福，俯瞰全景",
        ),
        SpotResponse(
            id="5",
            name="祥符禅寺",
            area_name="灵山胜境",
            category="古刹",
            summary="唐代千年古刹，灵山佛教文化发源地",
            highlight="千年银杏，祥符禅钟",
        ),
    ]
    return spots


@router.get("/spots/{spot_id}", response_model=SpotDetailResponse)
async def get_spot_detail(spot_id: str):
    """Get detailed information about a specific scenic spot."""
    # Mock data - will be connected to DB in Phase 2
    return SpotDetailResponse(
        id=spot_id,
        spot_code="LS-011",
        area_name="灵山胜境",
        name="灵山大佛",
        location="祥符禅寺北侧，秦履峰南侧",
        params="通高88米，总用铜量725吨",
        core_function="祈福朝圣、地标景观",
        cultural_significance="五方五佛之东方大佛，佛教文化象征",
        description="灵山大佛是世界最高露天青铜释迦牟尼立像...",
        highlights="登顶抱佛脚，俯瞰太湖全景",
        opening_hours="8:00-17:00",
        notes="重要佛教朝圣场所",
        category="佛教建筑",
    )


def _match_spots_in_text(text: str) -> list[str]:
    """Return spot names found in text, longest first (each name at most once)."""
    if not text:
        return []
    results = []
    for spot_name in sorted(SPOT_IMAGES.keys(), key=len, reverse=True):
        if spot_name in text:
            results.append(spot_name)
    return results


def _get_image_urls(question: str, answer: str) -> list[dict]:
    """Priority 1: spots mentioned in the user's question.
    Priority 2: spots mentioned in the AI's answer.
    Returns list of {url, name} objects."""
    question_spots = _match_spots_in_text(question)
    if question_spots:
        return [{"url": f"/{SPOT_IMAGES[name]}", "name": name} for name in question_spots]

    answer_spots = _match_spots_in_text(answer)
    return [{"url": f"/{SPOT_IMAGES[name]}", "name": name} for name in answer_spots]


@router.post("/qa", response_model=QAResponse)
async def text_qa(request: QARequest):
    """Text-based Q&A using RAG pipeline."""
    # Will be fully implemented in Phase 2
    session_id = request.session_id or str(uuid.uuid4())
    answer = f"感谢您的提问。关于「{request.query}」——灵山胜境是位于无锡的5A级景区，以灵山大佛为核心标志。\n\n本功能将在第二阶段完整实现，届时可以为您提供精准的知识库问答。"
    image_urls = _get_image_urls(request.query, answer)
    print(f'[DEBUG] 返回的 image_urls: {image_urls}')
    return QAResponse(
        answer=answer,
        session_id=session_id,
        emotion="friendly",
        related_spots=["灵山大佛"],
        image_urls=image_urls,
    )


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_route(request: RecommendRequest):
    """Generate personalized tour recommendations."""
    # Will be fully implemented in Phase 6
    return RecommendResponse(
        route=[
            RecommendItem(spot_id="1", name="灵山大佛", reason="标志性景点，必打卡", visit_duration=60),
            RecommendItem(spot_id="2", name="九龙灌浴", reason="震撼的动态表演", visit_duration=30),
            RecommendItem(spot_id="3", name="灵山梵宫", reason="佛教艺术殿堂", visit_duration=60),
        ],
        total_duration=150,
        tips="建议上午9点前入园，避开人流高峰",
    )


@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """Submit satisfaction feedback."""
    return {"status": "ok", "message": "感谢您的反馈！"}


@router.post("/session/init", response_model=SessionInitResponse)
async def init_session():
    """Initialize a new visitor session."""
    session_id = str(uuid.uuid4())
    return SessionInitResponse(
        session_id=session_id,
        welcome_message="您好！我是灵山胜境的AI数字人导游「灵小禅」🌸\n"
                       "我可以为您讲解景区历史、推荐游览路线、回答各种问题。\n"
                       "请问有什么可以帮您的？",
    )