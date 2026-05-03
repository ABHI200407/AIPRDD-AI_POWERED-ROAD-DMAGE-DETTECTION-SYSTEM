from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.smart_routing import calculate_route_penalty, VEHICLE_FACTORS
from services.road_health import score_road_segment, score_named_roads
from models.report import RoadDamageReport

router = APIRouter(prefix="/api/v1/routing", tags=["Smart Routing"])


# ─── Vehicle-Specific Smart Route ─────────────────────────────────────────────
class RouteRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    vehicle_type: str  # BIKE | CAR | TRUCK
    route_mode: str = "SAFEST"  # SAFEST | FASTEST | BALANCED


@router.post("/calculate")
def calculate_route(req: RouteRequest, db: Session = Depends(get_db)):
    """
    Vehicle-aware route calculation with damage penalization.
    Returns road quality score, hazard warnings, and a Google Maps deep link.
    """
    return calculate_route_penalty(
        req.origin_lat, req.origin_lon,
        req.dest_lat, req.dest_lon,
        req.vehicle_type,
        req.route_mode,
        db
    )


@router.get("/vehicles")
def get_vehicle_types():
    """Returns all supported vehicle types and their vulnerability factors."""
    return {"vehicles": VEHICLE_FACTORS}


# ─── Road Health Score ─────────────────────────────────────────────────────────
@router.get("/road-health")
def get_road_health(lat: float, lon: float, radius: float = 0.005, db: Session = Depends(get_db)):
    """Returns road health score (1-5 stars) for a given location."""
    return score_road_segment(lat, lon, radius, db)


@router.get("/road-health/all")
def get_all_road_health(db: Session = Depends(get_db)):
    """Returns health scores for all named road segments — used for heatmap data."""
    roads = score_named_roads(db)
    # Also add heatmap-ready data from all reports
    reports = db.query(RoadDamageReport).filter(RoadDamageReport.is_flagged == False).all()
    heatmap_points = [
        {
            "lat": r.latitude,
            "lon": r.longitude,
            "intensity": (r.user_confirmed_severity or r.ai_suggested_severity or 3) / 5.0
        }
        for r in reports if r.latitude and r.longitude
    ]
    return {"named_roads": roads, "heatmap_points": heatmap_points}
