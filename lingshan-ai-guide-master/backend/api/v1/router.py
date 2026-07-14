"""Aggregated API router for v1 endpoints."""
from fastapi import APIRouter

from backend.api.v1 import visitor, admin, auth

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(visitor.router, prefix="/visitor", tags=["游客端"])
api_router.include_router(admin.router, prefix="/admin", tags=["管理端"])
