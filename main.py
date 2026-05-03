from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from services.websocket_manager import manager
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import reports, routing, government, telemetry

# Create database tables
Base.metadata.create_all(bind=engine)

import os
import logging
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

# ─── LOGGING CONFIG ─────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO if os.getenv("DEBUG") != "True" else logging.DEBUG)
logger = logging.getLogger("road_safety_api")

# ─── RATE LIMITER ───────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="Road Safety App API",
    description="Backend API for AI-powered road damage detection and dynamic routing.",
    version="1.0.0",
    docs_url="/docs" if os.getenv("DEBUG") == "True" else None,
    redoc_url="/redoc" if os.getenv("DEBUG") == "True" else None
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins_str.split(",")] if allowed_origins_str != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(routing.router)
app.include_router(government.router)
app.include_router(telemetry.router)

@app.get("/")
@limiter.limit("5/minute")
def read_root():
    return {"message": "Road Safety App API is running.", "environment": os.getenv("ENVIRONMENT", "production")}

@app.get("/health")
def health_check():
    """Service health check for Render/Railway/AWS."""
    return {"status": "healthy", "timestamp": os.getenv("BUILD_TIME", "unknown")}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from client, just keep connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
