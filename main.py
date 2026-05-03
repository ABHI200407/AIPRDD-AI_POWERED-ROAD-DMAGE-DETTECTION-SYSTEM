from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from services.websocket_manager import manager
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import reports, routing, government, telemetry

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Road Safety App API",
    description="Backend API for AI-powered road damage detection and dynamic routing.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(routing.router)
app.include_router(government.router)
app.include_router(telemetry.router)

@app.get("/")
def read_root():
    return {"message": "Road Safety App API is running."}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from client, just keep connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
