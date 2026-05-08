from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import uuid
import io
import os
import httpx
import functools
from geopy.geocoders import Nominatim

from database import get_db
from models.report import RoadDamageReport
from services.websocket_manager import manager
from services.auth import get_current_user

# --- CONFIG ---
HF_SPACE_URL = os.getenv("HF_SPACE_URL") # Example: https://your-space.hf.space/detect
geolocator = Nominatim(user_agent="road_safety_sentinel")

@functools.lru_cache(maxsize=100)
def get_area_name(lat: float, lon: float) -> str:
    try:
        location = geolocator.reverse(f"{lat}, {lon}", exactly_one=True)
        if location and location.raw.get('address'):
            address = location.raw['address']
            return address.get('suburb') or address.get('neighbourhood') or address.get('city_district') or "Unknown Area"
    except:
        pass
    return "Unknown Area"

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

@router.post("/analyze")
async def analyze_image_remote(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Calls the external Hugging Face Space for YOLO inference to save Render RAM.
    """
    if not HF_SPACE_URL:
        # Fallback to local AI if HF Space URL is missing
        from services.ai_pipeline import analyze_road_damage
        return analyze_road_damage(await file.read())

    try:
        content = await file.read()
        async with httpx.AsyncClient() as client:
            files = {'file': ('image.jpg', content, 'image/jpeg')}
            response = await client.post(HF_SPACE_URL, files=files, timeout=30.0)
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"status": "error", "message": f"HF Space returned {response.status_code}", "detections": [], "top_class": "unknown"}
    except Exception as e:
        return {"status": "error", "message": str(e), "detections": [], "top_class": "unknown"}

# Pydantic models
class LocationSchema(BaseModel):
    latitude: float; longitude: float
    accuracy_meters: Optional[float] = None; heading: Optional[float] = None

class MediaSchema(BaseModel):
    raw_image_url: Optional[str] = None; ml_cropped_image_url: Optional[str] = None; video_clip_url: Optional[str] = None

class TelemetrySchema(BaseModel):
    speed_kmh: Optional[float] = None; g_force_z: Optional[float] = None; g_force_x: Optional[float] = None

class AssessmentSchema(BaseModel):
    damage_type: str; ai_suggested_severity: Optional[int] = Field(None, ge=1, le=5); user_confirmed_severity: Optional[int] = Field(None, ge=1, le=5)

class GamificationSchema(BaseModel):
    points_earned: Optional[int] = 0; badge_progress_id: Optional[str] = None; is_first_reporter: Optional[bool] = False

class ReportCreate(BaseModel):
    report_id: Optional[str] = None; user_id: str; timestamp_captured: datetime; location: LocationSchema
    media: Optional[MediaSchema] = None; telemetry: Optional[TelemetrySchema] = None; assessment: AssessmentSchema
    gamification: Optional[GamificationSchema] = None; source: Optional[str] = "CITIZEN"
    is_impact_verified: Optional[bool] = False; area_name: Optional[str] = None

class ReportResponse(BaseModel):
    report_id: str; status: str = "success"

@router.post("", response_model=ReportResponse)
async def create_report(report: ReportCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
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
        user_confirmed_severity=report.assessment.user_confirmed_severity,
        source=report.source,
        is_impact_verified=report.is_impact_verified
    )
    
    # Auto-map to Area
    db_report.area_name = report.area_name or get_area_name(report.location.latitude, report.location.longitude)

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
    
    # ─── PREDICTIVE DETERIORATION & LIVE WARNINGS ──────────────────────────
    historical = db.query(RoadDamageReport).filter(
        RoadDamageReport.latitude.between(db_report.latitude - 0.0001, db_report.latitude + 0.0001),
        RoadDamageReport.longitude.between(db_report.longitude - 0.0001, db_report.longitude + 0.0001),
        RoadDamageReport.report_id != db_report.report_id
    ).order_by(RoadDamageReport.timestamp_captured.desc()).first()

    if historical:
        prev_sev = historical.user_confirmed_severity or historical.ai_suggested_severity or 1
        curr_sev = db_report.user_confirmed_severity or db_report.ai_suggested_severity or 1
        if curr_sev > prev_sev:
            await manager.broadcast({"type": "DETERIORATION_ALERT", "area": db_report.area_name, "growth": f"{((curr_sev - prev_sev) / prev_sev * 100):.0f}% increase", "report_id": db_report.report_id})

    if (db_report.ai_suggested_severity or 0) >= 4 or db_report.is_impact_verified:
        await manager.broadcast({"type": "HAZARD_ALERT", "hazard_type": db_report.damage_type, "severity": db_report.ai_suggested_severity or 5, "lat": db_report.latitude, "lon": db_report.longitude, "msg": f"CAUTION: {db_report.damage_type} detected ahead!"})
    # ──────────────────────────────────────────────────────────────────────

    await manager.broadcast({"type": "NEW_REPORT", "report_id": db_report.report_id})
    return {"report_id": db_report.report_id, "status": "success"}

@router.get("")
def get_reports(min_lat: float, max_lat: float, min_lon: float, max_lon: float, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    reports = db.query(RoadDamageReport).filter(RoadDamageReport.latitude >= min_lat, RoadDamageReport.latitude <= max_lat, RoadDamageReport.longitude >= min_lon, RoadDamageReport.longitude <= max_lon).all()
    return {"data": reports}


@router.post("/{report_id}/verify")
def verify_report(report_id: str, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    report = db.query(RoadDamageReport).filter(RoadDamageReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.verification_count += 1
    db.commit()
    db.refresh(report)
    return report


@router.post("/{report_id}/fix-verify")
def fix_verify_report(report_id: str, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    report = db.query(RoadDamageReport).filter(RoadDamageReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.fixed_confirmation_count += 1
    if report.fixed_confirmation_count >= 3:
        report.is_flagged = True
    db.commit()
    db.refresh(report)
    return report
