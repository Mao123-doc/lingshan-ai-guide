"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from backend.config import settings
from backend.db.session import init_db, close_db
from backend.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("Starting Ling Shan Tour Guide System...")

    # Create data directories
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Initialize vector store (lazy - first request will trigger)
    logger.info("Vector store ready for lazy initialization")

    yield

    # Shutdown
    await close_db()
    logger.info("Database connections closed")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="灵山胜境 AI 数字人导游系统",
        description="AI Digital Human Tour Guide for Ling Shan Sacred Land",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routes
    app.include_router(api_router, prefix="/api/v1")

    # Health check
    @app.get("/health")
    async def health_check():
        return {"status": "ok", "service": "灵山胜境 AI 数字人导游"}

    # Mount static files (images, etc.) from frontend/public
    app.mount("/", StaticFiles(directory="frontend/public", html=True), name="static")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
