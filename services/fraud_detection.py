"""
Fraud Detection Service
========================
Flags suspicious patterns in incoming reports.
"""

from sqlalchemy.orm import Session
from models.report import RoadDamageReport
from datetime import datetime, timezone, timedelta


SUSPICIOUS_REPORTS_IN_WINDOW = 10  # same user, same hour
MIN_GPS_DISTANCE_METERS = 5       # reports too close together


def calculate_fraud_score(report_dict: dict, db: Session) -> dict:
    """
    Analyses a new incoming report for fraud signals.
    Returns a fraud_score (0.0 = clean, 1.0 = highly suspicious) and flags.
    """
    flags = []
    score = 0.0

    user_id = report_dict.get("user_id")
    lat = report_dict.get("location", {}).get("latitude")
    lon = report_dict.get("location", {}).get("longitude")

    # Check 1: Rapid submission flood (same user, last hour)
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_count = db.query(RoadDamageReport).filter(
        RoadDamageReport.user_id == user_id,
        RoadDamageReport.timestamp_captured >= one_hour_ago
    ).count()

    if recent_count >= SUSPICIOUS_REPORTS_IN_WINDOW:
        flags.append("FLOOD_DETECTION: Too many reports from same user in 1 hour")
        score += 0.4

    # Check 2: Duplicate GPS (exact same coordinates)
    if lat and lon:
        exact_dup = db.query(RoadDamageReport).filter(
            RoadDamageReport.latitude == lat,
            RoadDamageReport.longitude == lon,
            RoadDamageReport.user_id == user_id
        ).count()
        if exact_dup > 0:
            flags.append("GPS_DUPLICATE: Exact GPS match by same user")
            score += 0.5

    # Check 3: Default/Zero GPS (fake GPS)
    if lat == 0.0 and lon == 0.0:
        flags.append("FAKE_GPS: Zero coordinates submitted")
        score += 0.8

    # Check 4: Bot Swarm Attack (Adversarial Defense)
    if lat and lon:
        five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
        # 1km radius roughly 0.01 degrees lat/lon
        swarm_count = db.query(RoadDamageReport).filter(
            RoadDamageReport.latitude.between(lat - 0.01, lat + 0.01),
            RoadDamageReport.longitude.between(lon - 0.01, lon + 0.01),
            RoadDamageReport.timestamp_captured >= five_mins_ago
        ).count()

        if swarm_count >= 50:
            flags.append("BOT_SWARM_ATTACK: Anomalous report volume in this sector")
            score += 0.9

    is_suspicious = score >= 0.5

    return {
        "fraud_score": min(score, 1.0),
        "is_suspicious": is_suspicious,
        "flags": flags
    }
