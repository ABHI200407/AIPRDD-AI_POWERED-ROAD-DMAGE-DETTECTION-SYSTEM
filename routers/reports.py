from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from database import get_db
from models.report import RoadDamageReport
from services.websocket_manager import manager

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

# Pydantic models for incoming requests
class LocationSchema(BaseModel):
    latitude: float
    longitude: float
    accuracy_meters: Optional[float] = None
    heading: Optional[float] = None

class MediaSchema(BaseModel):
    raw_image_url: Optional[str] = None
    ml_cropped_image_url: Optional[str] = None
    video_clip_url: Optional[str] = None

class TelemetrySchema(BaseModel):
    speed_kmh: Optional[float] = None
    g_force_z: Optional[float] = None
    g_force_x: Optional[float] = None

class AssessmentSchema(BaseModel):
    damage_type: str
    ai_suggested_severity: Optional[int] = Field(None, ge=1, le=5)
    user_confirmed_severity: Optional[int] = Field(None, ge=1, le=5)

class GamificationSchema(BaseModel):
    points_earned: Optional[int] = 0
    badge_progress_id: Optional[str] = None
    is_first_reporter: Optional[bool] = False

class ReportCreate(BaseModel):
    report_id: Optional[str] = None
    user_id: str
    timestamp_captured: datetime
    location: LocationSchema
    media: Optional[MediaSchema] = None
    telemetry: Optional[TelemetrySchema] = None
    assessment: AssessmentSchema
    gamification: Optional[GamificationSchema] = None

class ReportResponse(BaseModel):
    report_id: str
    status: str = "success"

@router.post("", response_model=ReportResponse)
async def create_report(report: ReportCreate, db: Session = Depends(get_db)):
    db_report = RoadDamageReport(
        report_id=report.report_id or str(uuid.uuid4()),
        user_id=report.user_id,
        timestamp_captured=report.timestamp_captured,
        latitude=report.location.latitude,
        longitude=report.location.longitude,
        accuracy_meters=report.location.accuracy_meters,
        heading=report.location.heading,
        damage_type=report.assessment.damage_type,
        ai_suggested_severity=report.assessment.ai_suggested_severity,
        user_confirmed_severity=report.assessment.user_confirmed_severity
    )
    
    if report.media:
        db_report.raw_image_url = report.media.raw_image_url
        db_report.ml_cropped_image_url = report.media.ml_cropped_image_url
        db_report.video_clip_url = report.media.video_clip_url
        
        # ─── REAL AI VERIFICATION ─────────────────────────────────────────────
        if report.media.raw_image_url and report.media.raw_image_url.startswith('http'):
            from services.ai_pipeline import analyze_road_damage
            import requests
            try:
                img_res = requests.get(report.media.raw_image_url, timeout=5)
                if img_res.status_code == 200:
                    ai_result = analyze_road_damage(img_res.content)
                    db_report.ai_suggested_severity = ai_result["suggested_severity"]
                    if ai_result["detections"]:
                        # Update type to what AI actually saw
                        db_report.damage_type = ai_result["detections"][0]["type"].upper()
            except Exception as e:
                print(f"AI Background Analysis Failed: {e}")
        # ──────────────────────────────────────────────────────────────────────
        
    if report.telemetry:
        db_report.speed_kmh = report.telemetry.speed_kmh
        db_report.g_force_z = report.telemetry.g_force_z
        db_report.g_force_x = report.telemetry.g_force_x
        
    if report.gamification:
        db_report.points_earned = report.gamification.points_earned
        db_report.badge_progress_id = report.gamification.badge_progress_id
        db_report.is_first_reporter = report.gamification.is_first_reporter

    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    # Broadcast live event to government dashboard
    await manager.broadcast({"type": "NEW_REPORT", "report_id": db_report.report_id})
    
    return {"report_id": db_report.report_id, "status": "success"}

@router.get("")
def get_reports(min_lat: float, max_lat: float, min_lon: float, max_lon: float, db: Session = Depends(get_db)):
    # Simple bounding box query (mocking spatial search)
    reports = db.query(RoadDamageReport).filter(
        RoadDamageReport.latitude >= min_lat,
        RoadDamageReport.latitude <= max_lat,
        RoadDamageReport.longitude >= min_lon,
        RoadDamageReport.longitude <= max_lon
    ).all()
    
    return {"data": reports}
