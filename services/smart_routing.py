"""
Vehicle-Specific Smart Routing Engine (v2 - Production Ready)
=============================================================
Uses A* pathfinding on a weighted grid to find the safest path.
"""

import math
import logging
from sqlalchemy.orm import Session
from models.report import RoadDamageReport
from services.pathfinder import Pathfinder
from typing import List, Dict

# Configure Logging
logger = logging.getLogger("SmartRouting")

# ─── ROUTING CONFIGURATION ────────────────────────────────────────────────────
ROUTING_CONFIG = {
    "HAZARD_PROXIMITY_METERS": 20,
    "DEFAULT_CORRIDOR_MARGIN": 0.02,
    "MIN_SAFETY_CORRIDOR": 0.005,
    "MAX_BBOX_SIZE": 0.5,
    "PENALTY_TIME_MULTIPLIER": 50, # Seconds added per (severity^2 * vehicle_factor)
}

VEHICLE_FACTORS = {
    "BIKE":  {"factor": 3.0, "label": "Bike / Scooter",  "icon": "🏍️", "max_safe_severity": 2},
    "CAR":   {"factor": 1.0, "label": "Car / SUV",        "icon": "🚗", "max_safe_severity": 3},
    "TRUCK": {"factor": 0.4, "label": "Truck / Bus",      "icon": "🚛", "max_safe_severity": 5},
}

def haversine(la1, lo1, la2, lo2):
    R = 6371000
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = math.radians(la2 - la1), math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_route_penalty(
    origin_lat: float, origin_lon: float,
    dest_lat: float, dest_lon: float,
    vehicle_type: str,
    route_mode: str,
    db: Session
) -> Dict:
    vtype = vehicle_type.upper()
    vinfo = VEHICLE_FACTORS.get(vtype, VEHICLE_FACTORS["CAR"])
    rmode = route_mode.upper()

    # Define corridor with dynamic margin
    margin = ROUTING_CONFIG["DEFAULT_CORRIDOR_MARGIN"]
    if abs(origin_lat - dest_lat) > ROUTING_CONFIG["MAX_BBOX_SIZE"] or \
       abs(origin_lon - dest_lon) > ROUTING_CONFIG["MAX_BBOX_SIZE"]:
        margin = ROUTING_CONFIG["MIN_SAFETY_CORRIDOR"]
    
    min_lat, max_lat = min(origin_lat, dest_lat) - margin, max(origin_lat, dest_lat) + margin
    min_lon, max_lon = min(origin_lon, dest_lon) - margin, max(origin_lon, dest_lon) + margin

    # Fetch relevant hazards
    hazards = db.query(RoadDamageReport).filter(
        RoadDamageReport.latitude.between(min_lat, max_lat),
        RoadDamageReport.longitude.between(min_lon, max_lon),
        RoadDamageReport.is_flagged == False
    ).all()

    # Build optimized graph
    pf = Pathfinder(min_lat, min_lon, max_lat, max_lon)
    pf.build_graph()
    
    # ─── MODE-BASED PENALTY SCALING ───────────────────────────────────────────
    # FASTEST: Get there quick, minor damage is acceptable.
    # SMOOTHEST: Zero tolerance for suspension damage.
    # SAFE_AT_NIGHT: Avoid severe holes, but prioritize main well-lit routes.
    
    penalty_mod = 0.1  # Default FASTEST
    if rmode == "SMOOTHEST" or rmode == "SAFEST":
        penalty_mod = 1.0
    elif rmode == "SAFE_AT_NIGHT" or rmode == "BALANCED":
        penalty_mod = 0.5
    
    for h in hazards:
        sev = h.user_confirmed_severity or h.ai_suggested_severity or 3
        pf.add_hazard(h.latitude, h.longitude, sev * penalty_mod * vinfo["factor"])

    # Calculate optimal path
    real_path = pf.find_path(origin_lat, origin_lon, dest_lat, dest_lon)
    
    # Calculate performance-aware stats
    distance_m = 0
    total_time_s = 0
    hazards_hit_ids = set()
    
    for i in range(len(real_path)-1):
        p1, p2 = real_path[i], real_path[i+1]
        step_dist = haversine(p1["lat"], p1["lng"], p2["lat"], p2["lng"])
        distance_m += step_dist
        
        # Base speed 40km/h
        speed_kmh = 40
        if rmode == "FASTEST": speed_kmh = 50
        elif rmode == "SMOOTHEST": speed_kmh = 35
        
        total_time_s += step_dist / (speed_kmh / 3.6) 

        for h in hazards:
            if h.report_id not in hazards_hit_ids:
                d = haversine(p1["lat"], p1["lng"], h.latitude, h.longitude)
                if d < ROUTING_CONFIG["HAZARD_PROXIMITY_METERS"]:
                    hazards_hit_ids.add(h.report_id)

    # ─── PSYCHOLOGICAL STATS ──────────────────────────────────────────────────
    num_hazards = len(hazards_hit_ids)
    wear_cost = 0
    for h_id in hazards_hit_ids:
        h = next(hr for hr in hazards if hr.report_id == h_id)
        sev = h.user_confirmed_severity or h.ai_suggested_severity or 3
        wear_cost += (sev ** 2) * vinfo["factor"] * 50
    
    quality_score = max(1.0, 5.0 - (num_hazards * vinfo["factor"] * 0.5))
    suspension_safety = max(0, 100 - (num_hazards * vinfo["factor"] * 15))
    
    # Recommendation logic
    labels = {
        "FASTEST": "Express Path",
        "SMOOTHEST": "Shield Path",
        "SAFEST": "Shield Path",
        "SAFE_AT_NIGHT": "Midnight Guard",
        "BALANCED": "Balanced Path"
    }
    
    rec = "Pristine road quality. Your suspension is safe." if num_hazards == 0 else \
          f"Avoided {len(hazards) - num_hazards} hazards; ₹{int(wear_cost)} estimated wear risk."

    return {
        "vehicle_type": vtype,
        "vehicle_label": vinfo["label"],
        "vehicle_icon": vinfo["icon"],
        "route_mode": rmode,
        "route_label": labels.get(rmode, "Smart Path"),
        "distance_km": round(distance_m / 1000, 2),
        "adjusted_travel_min": round(total_time_s / 60, 1),
        "road_quality_score": round(quality_score, 1),
        "suspension_safety_index": round(suspension_safety, 1),
        "estimated_wear_cost": int(wear_cost),
        "hazards_on_route": num_hazards,
        "all_hazards": [
            {
                "latitude": h.latitude, "longitude": h.longitude,
                "severity": h.user_confirmed_severity or h.ai_suggested_severity or 3,
                "type": h.damage_type,
                "is_critical": (h.user_confirmed_severity or h.ai_suggested_severity or 3) > vinfo["max_safe_severity"]
            } for h in hazards
        ],
        "google_maps_url": f"https://www.google.com/maps/dir/?api=1&origin={origin_lat},{origin_lon}&destination={dest_lat},{dest_lon}",
        "recommendation": rec,
        "geometry": real_path
    }
