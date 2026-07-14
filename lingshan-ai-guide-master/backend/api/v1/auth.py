"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login and receive JWT access token."""
    # TODO: Implement proper JWT auth with database users
    # For now, accept default admin credentials
    if request.username == "admin" and request.password == "ling_shan_2024":
        return LoginResponse(
            access_token="demo_token_placeholder",
            token_type="bearer",
            username="admin",
            role="admin",
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="用户名或密码错误",
    )
