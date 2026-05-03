"""
Smart Repair Route Optimizer (Government)
==========================================
Given a list of open MasterTickets (potholes to fix),
calculates the optimal TSP-like order for a crew to visit them
to minimize total travel distance — the "milkman problem".

Algorithm: Nearest Neighbor Greedy heuristic (fast, good enough for ≤50 stops)
For production: upgrade to Google OR-Tools VRP solver.
"""

import math
from typing import List, Tuple, Dict
from sqlalchemy.orm import Session
from models.government import MasterTicket
from services.pathfinder import Pathfinder


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    """Returns distance between two points in meters."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def optimise_repair_route(
    crew_lat: float,
    crew_lon: float,
    db: Session,
    max_stops: int = 15
) -> Dict:
    """
    Returns the ordered list of tickets a crew should visit for maximum efficiency.
    """
    tickets = (
        db.query(MasterTicket)
        .filter(MasterTicket.status == "OPEN")
        .order_by(MasterTicket.priority_score.desc())
        .limit(max_stops)
        .all()
    )

    if not tickets:
        return {"route": [], "total_distance_m": 0, "estimated_hours": 0}

    unvisited = list(tickets)
    route = []
    cur_lat, cur_lon = crew_lat, crew_lon
    total_dist = 0.0

    while unvisited:
        # Find nearest unvisited ticket (Greedy TSP)
        nearest = min(unvisited, key=lambda t: haversine_m(cur_lat, cur_lon, t.latitude, t.longitude))
        dist = haversine_m(cur_lat, cur_lon, nearest.latitude, nearest.longitude)
        
        # Calculate road-aligned path to this ticket
        # We use a small bbox around the segment to keep it fast
        margin = 0.01 
        pf = Pathfinder(
            min(cur_lat, nearest.latitude) - margin, min(cur_lon, nearest.longitude) - margin,
            max(cur_lat, nearest.latitude) + margin, max(cur_lon, nearest.longitude) + margin
        )
        pf.build_graph()
        segment_path = pf.find_path(cur_lat, cur_lon, nearest.latitude, nearest.longitude)
        
        total_dist += dist
        route.append({
            "stop": len(route) + 1,
            "ticket_id": nearest.ticket_id,
            "latitude": nearest.latitude,
            "longitude": nearest.longitude,
            "priority_score": nearest.priority_score,
            "base_severity": nearest.base_severity,
            "drive_distance_m": round(dist),
            "path_to": segment_path # The actual road-following geometry
        })
        cur_lat, cur_lon = nearest.latitude, nearest.longitude
        unvisited.remove(nearest)

    # Estimate: 45 min/repair + 3 min per km driving
    repair_hours = len(route) * 0.75
    drive_hours = (total_dist / 1000) * (3 / 60)

    return {
        "route": route,
        "total_distance_m": round(total_dist),
        "total_distance_km": round(total_dist / 1000, 1),
        "estimated_repair_hours": round(repair_hours + drive_hours, 1),
    }
