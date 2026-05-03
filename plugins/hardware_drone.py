"""
HARDWARE PLUGIN INTERFACE: Drone Survey
========================================
This module acts as a clean abstraction layer between the software and a real
drone hardware/API. To connect real hardware:

1. Set DRONE_MODE = "live" in your .env
2. Replace the _live_survey() method with calls to your drone SDK
   (e.g., DJI SDK, Autel SDK, or any REST-based drone platform API)

Currently runs in SIMULATION mode - generates AI-detected damage reports.
"""

import uuid
import random
from datetime import datetime, timezone
from typing import List, Dict

# ─────────────────────────────────────────────
# PLUGIN CONFIGURATION (editable per deployment)
# ─────────────────────────────────────────────
DRONE_MODE = "simulation"  # Change to "live" when real drone is connected
DRONE_API_ENDPOINT = "http://your-drone-api:8080/survey"  # Plug in your drone API URL
DRONE_API_KEY = "YOUR_DRONE_API_KEY"  # Plug in your drone API key


def run_drone_survey(center_lat: float, center_lon: float, radius_km: float) -> List[Dict]:
    """
    Main entry point. Runs either simulation or live drone survey.
    Returns a list of detected damage reports in the standard schema.
    """
    if DRONE_MODE == "live":
        return _live_survey(center_lat, center_lon, radius_km)
    else:
        return _simulate_survey(center_lat, center_lon, radius_km)


def _simulate_survey(center_lat: float, center_lon: float, radius_km: float) -> List[Dict]:
    """
    SIMULATION MODE: Generates realistic mock AI-detected pothole reports
    as if a drone flew the area and ML processed the footage.
    """
    damage_types = ["POTHOLE", "CRACK", "UNEVEN_SURFACE", "DEBRIS"]
    num_detections = random.randint(8, 20)
    reports = []

    for _ in range(num_detections):
        lat_offset = random.uniform(-radius_km / 111, radius_km / 111)
        lon_offset = random.uniform(-radius_km / 111, radius_km / 111)
        reports.append({
            "report_id": str(uuid.uuid4()),
            "user_id": "DRONE_AI_SYSTEM",
            "timestamp_captured": datetime.now(timezone.utc).isoformat(),
            "source": "DRONE_SURVEY",
            "location": {
                "latitude": center_lat + lat_offset,
                "longitude": center_lon + lon_offset,
                "accuracy_meters": 0.5,
            },
            "assessment": {
                "damage_type": random.choice(damage_types),
                "ai_suggested_severity": random.randint(2, 5),
                "user_confirmed_severity": None,
                "ai_confidence": round(random.uniform(0.88, 0.99), 2),
            }
        })
    return reports


def _live_survey(center_lat: float, center_lon: float, radius_km: float) -> List[Dict]:
    """
    ═══════════════════════════════════════════════════
    HARDWARE PLUG-IN POINT 🔌
    ═══════════════════════════════════════════════════
    Replace this function body with your real drone SDK calls.
    Example with a REST-based drone API:

        import requests
        response = requests.post(
            DRONE_API_ENDPOINT,
            headers={"Authorization": f"Bearer {DRONE_API_KEY}"},
            json={"lat": center_lat, "lon": center_lon, "radius_km": radius_km}
        )
        return response.json()["detections"]
    """
    raise NotImplementedError(
        "Live drone hardware not connected. "
        "Set DRONE_MODE='simulation' or implement _live_survey() with your drone SDK."
    )
