"""Application configuration using pydantic-settings."""
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from .env file and environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM Configuration
    llm_provider: str = "qwen"
    qwen_api_key: Optional[str] = None
    qwen_model: str = "qwen-plus"
    deepseek_api_key: Optional[str] = None
    deepseek_model: str = "deepseek-chat"

    # Embedding
    embedding_model: str = "BAAI/bge-large-zh-v1.5"
    embedding_device: str = "cpu"
    embedding_cache_dir: str = "./data/model_cache"

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/ling_shan.db"
    chroma_persist_dir: str = "./data/chroma_db"

    # Security
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # TTS
    tts_engine: str = "edge-tts"
    tts_voice: str = "zh-CN-XiaoxiaoNeural"

    # ASR
    asr_model_size: str = "base"
    asr_device: str = "cpu"
    asr_compute_type: str = "int8"

    # Upload
    max_upload_size_mb: int = 20
    upload_dir: str = "./data/uploads"

    # Baidu Map
    baidu_map_ak: str = "ZT4ycNFGJ6Q5JzZs6IRCXTRjhQGtHpIx"

    @property
    def llm_api_key(self) -> Optional[str]:
        """Get API key for current LLM provider."""
        if self.llm_provider == "qwen":
            return self.qwen_api_key
        elif self.llm_provider == "deepseek":
            return self.deepseek_api_key
        return None

    @property
    def llm_model(self) -> str:
        """Get model name for current LLM provider."""
        if self.llm_provider == "qwen":
            return self.qwen_model
        elif self.llm_provider == "deepseek":
            return self.deepseek_model
        return "qwen-plus"


# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent

# Singleton settings instance
settings = Settings()
