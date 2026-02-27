import logging
import sys

# 配置日志 - 确保输出到控制台
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# 设置特定模块的日志级别
logging.getLogger("api.websocket").setLevel(logging.DEBUG)
logging.getLogger("agents").setLevel(logging.DEBUG)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import settings
from database import engine, Base
from api import projects, sessions, messages, websocket, audio, assets, auth

# Create database tables
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    print("[STARTUP] 应用启动完成")

    yield  # 应用运行中

    # 关闭时清理（如果需要）


app = FastAPI(
    title="AI Interview Coach API",
    description="Backend API for AI Interview Coach MVP",
    version="0.1.0",
    redirect_slashes=False,  # 禁用自动重定向，避免 Authorization header 丢失
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(sessions.router)
app.include_router(messages.router)
app.include_router(websocket.router)
app.include_router(audio.router)
app.include_router(assets.router)


@app.get("/")
def root():
    return {"message": "AI Interview Coach API", "version": "0.1.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
