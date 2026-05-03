"""
Road Health Scoring Engine
===========================
Calculates a 1-5 star road quality score for any geo-bounding box
based on the density and severity of active damage reports.

Score Formula:
  raw = Σ(report_severity) / max_possible_damage
  road_health = 5 - (raw * 5)   clamped to [1, 5]
"""

from sqlalchemy.orm import Session
from models.report import RoadDamageReport
from typing import List, Dict


def score_road_segment(lat: float, lon: float, radius_deg: float, db: Session) -> Dict:
    """
    Returns a road health score (1–5 stars) and damage density for a coordinate.
    radius_deg: search radius in degrees (~0.005 = ~500m)
    """
    reports = db.query(RoadDamageReport).filter(
        RoadDamageReport.latitude.between(lat - radius_deg, lat + radius_deg),
        RoadDamageReport.longitude.between(lon - radius_deg, lon + radius_deg),
        RoadDamageReport.is_flagged == False
    ).all()

    if not reports:
        return {"health_score": 5.0, "stars": 5, "damage_count": 0, "dominant_type": None}

    total_severity = sum(r.user_confirmed_severity or r.ai_suggested_severity or 3 for r in reports)
    max_possible = len(reports) * 5
    raw_damage = total_severity / max_possible
    health_score = max(1.0, round(5.0 - (raw_damage * 4.0), 1))

    # Dominant damage type
    types = [r.damage_type for r in reports if r.damage_type]
    dominant = max(set(types), key=types.count) if types else None

    return {
        "health_score": health_score,
        "stars": round(health_score),
        "damage_count": len(reports),
        "dominant_type": dominant,
        "avg_severity": round(total_severity / len(reports), 1)
    }


def score_named_roads(db: Session) -> List[Dict]:
    """Returns health scores for all named road segments in the DB."""
    reports = db.query(RoadDamageReport).filter(
        RoadDamageReport.road_segment_name != None
    ).all()

    grouped: Dict[str, list] = {}
    for r in reports:
        grouped.setdefault(r.road_segment_name, []).append(r)

    results = []
    for road_name, road_reports in grouped.items():
        total_sev = sum(r.user_confirmed_severity or r.ai_suggested_severity or 3 for r in road_reports)
        max_poss = len(road_reports) * 5
        raw = total_sev / max_poss
        health = max(1.0, round(5 - raw * 4, 1))
        results.append({
            "road_name": road_name,
            "health_score": health,
            "stars": round(health),
            "report_count": len(road_reports),
            "center_lat": sum(r.latitude for r in road_reports) / len(road_reports),
            "center_lon": sum(r.longitude for r in road_reports) / len(road_reports),
        })

    return sorted(results, key=lambda x: x["health_score"])
