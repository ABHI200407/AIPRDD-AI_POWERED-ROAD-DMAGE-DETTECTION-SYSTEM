from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models.report import RoadDamageReport, MaintenanceHistory
from models.government import MasterTicket, TicketCluster
from services.clustering import perform_geo_clustering, calculate_cluster_center
from services.priority_engine import calculate_priority
from services.sla_monitor import get_sla_report
from services.fraud_detection import calculate_fraud_score
from services.repair_route import optimise_repair_route
from plugins.hardware_drone import run_drone_survey
from plugins.weather_api import get_weather_forecast
import uuid
from datetime import datetime, timezone
from services.auth import get_current_user

router = APIRouter(prefix="/api/v1/gov", tags=["Government AI Dashboard"], dependencies=[Depends(get_current_user)])


# ─── TICKETS ──────────────────────────────────────────────────────────────────
@router.get("/tickets")
def get_master_tickets(db: Session = Depends(get_db)):
    tickets = db.query(MasterTicket).order_by(MasterTicket.priority_score.desc()).all()
    return {"data": tickets}
    
@router.post("/reports/aggregate")
def aggregate_reports_to_tickets(db: Session = Depends(get_db)):
    """
    Aggregation Engine: Groups citizen reports into Master Tickets.
    Prevents duplicate maintenance orders for the same pothole.
    """
    reports = db.query(RoadDamageReport).filter(RoadDamageReport.is_flagged == False).all()
    if not reports:
        return {"message": "No reports to aggregate."}
        
    coords = [(r.latitude, r.longitude) for r in reports]
    # Cluster reports within 20m as the same physical hazard
    labels = perform_geo_clustering(coords, eps_meters=20.0, min_samples=1) 
    
    clusters = {}
    for report, label in zip(reports, labels):
        clusters.setdefault(label, []).append(report)
        
    tickets_created = 0
    for label, cluster_reports in clusters.items():
        center_lat, center_lon = calculate_cluster_center([(r.latitude, r.longitude) for r in cluster_reports])
        
        # Check for existing ticket in the vicinity
        existing_ticket = db.query(MasterTicket).filter(
            MasterTicket.latitude.between(center_lat - 0.0002, center_lat + 0.0002),
            MasterTicket.longitude.between(center_lon - 0.0002, center_lon + 0.0002)
        ).first()
        
        if existing_ticket:
            existing_ticket.duplicate_count += len(cluster_reports)
            max_sev = max([r.user_confirmed_severity or r.ai_suggested_severity or 1 for r in cluster_reports])
            existing_ticket.base_severity = max(existing_ticket.base_severity, max_sev)
            existing_ticket.priority_score = calculate_priority(existing_ticket.base_severity, existing_ticket.duplicate_count, 5000, False, False)
        else:
            max_sev = max([r.user_confirmed_severity or r.ai_suggested_severity or 1 for r in cluster_reports])
            new_ticket = MasterTicket(
                latitude=center_lat, longitude=center_lon,
                duplicate_count=len(cluster_reports),
                base_severity=max_sev,
                priority_score=calculate_priority(max_sev, len(cluster_reports), 5000, False, False)
            )
            db.add(new_ticket)
            tickets_created += 1
            
    db.commit()
    return {"status": "success", "tickets_created": tickets_created, "reports_processed": len(reports)}


@router.post("/clusters/generate")
def generate_daily_clusters(db: Session = Depends(get_db)):
    open_tickets = db.query(MasterTicket).filter(MasterTicket.status == "OPEN").all()
    if not open_tickets:
        return {"message": "No open tickets to cluster."}
    coords = [(t.latitude, t.longitude) for t in open_tickets]
    labels = perform_geo_clustering(coords, eps_meters=500.0)
    clusters_data = {}
    for ticket, label in zip(open_tickets, labels):
        if label == -1:
            ticket.cluster_id = None
            continue
        clusters_data.setdefault(label, []).append(ticket)
    created_clusters = []
    for label, tickets in clusters_data.items():
        cluster_coords = [(t.latitude, t.longitude) for t in tickets]
        center_lat, center_lon = calculate_cluster_center(cluster_coords)
        new_cluster = TicketCluster(
            center_lat=center_lat, center_lon=center_lon,
            ticket_count=len(tickets),
            estimated_repair_hours=len(tickets) * 0.75
        )
        db.add(new_cluster)
        db.flush()
        for t in tickets:
            t.cluster_id = new_cluster.cluster_id
        created_clusters.append(new_cluster.cluster_id)
    db.commit()
    return {"status": "success", "clusters_generated": len(created_clusters)}


# ─── CREW DISPATCH ────────────────────────────────────────────────────────────
AVAILABLE_CREWS = [
    {"id": "CREW_A", "name": "Alpha Unit",   "specialty": "POTHOLE",         "capacity": 8},
    {"id": "CREW_B", "name": "Bravo Unit",   "specialty": "CRACK",           "capacity": 6},
    {"id": "CREW_C", "name": "Charlie Unit", "specialty": "ANY",             "capacity": 10},
    {"id": "CREW_D", "name": "Delta Unit",   "specialty": "UNEVEN_SURFACE",  "capacity": 5},
]


@router.post("/dispatch")
def auto_dispatch_crews(db: Session = Depends(get_db)):
    unassigned = db.query(TicketCluster).filter(TicketCluster.assigned_crew_id == None).all()
    if not unassigned:
        return {"message": "All clusters already assigned."}
    dispatched = []
    for i, cluster in enumerate(unassigned):
        crew = AVAILABLE_CREWS[i % len(AVAILABLE_CREWS)]
        cluster.assigned_crew_id = crew["id"]
        dispatched.append({"cluster_id": cluster.cluster_id, "crew": crew["name"], "estimated_hours": cluster.estimated_repair_hours})
    db.commit()
    return {"status": "success", "dispatched": dispatched}


@router.get("/crews")
def get_crews(db: Session = Depends(get_db)):
    clusters = db.query(TicketCluster).all()
    crew_workload = {c["id"]: {"crew": c, "clusters": [], "total_hours": 0} for c in AVAILABLE_CREWS}
    for cluster in clusters:
        if cluster.assigned_crew_id and cluster.assigned_crew_id in crew_workload:
            crew_workload[cluster.assigned_crew_id]["clusters"].append(cluster.cluster_id)
            crew_workload[cluster.assigned_crew_id]["total_hours"] += (cluster.estimated_repair_hours or 0)
    return {"data": list(crew_workload.values())}


# ─── SMART REPAIR ROUTE ────────────────────────────────────────────────────────
class RepairRouteRequest(BaseModel):
    crew_lat: float
    crew_lon: float
    max_stops: Optional[int] = 12


@router.post("/repair-route")
def get_optimal_repair_route(req: RepairRouteRequest, db: Session = Depends(get_db)):
    """Returns optimal TSP-ordered repair route for a field crew."""
    return optimise_repair_route(req.crew_lat, req.crew_lon, db, req.max_stops)


# ─── MAINTENANCE HISTORY ──────────────────────────────────────────────────────
class HistoryCreate(BaseModel):
    ticket_id: str
    road_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    action: str
    performed_by: str
    notes: Optional[str] = None
    cost_inr: Optional[float] = 0.0


@router.post("/history")
def add_maintenance_history(payload: HistoryCreate, db: Session = Depends(get_db)):
    record = MaintenanceHistory(**payload.dict())
    db.add(record)
    # Update ticket status if action is repair-related
    ticket = db.query(MasterTicket).filter(MasterTicket.ticket_id == payload.ticket_id).first()
    if ticket:
        if payload.action in ("PATCHED", "RESURFACED"):
            ticket.status = "IN_PROGRESS"
        elif payload.action == "CLOSED":
            ticket.status = "RESOLVED"
    db.commit()
    return {"status": "success", "history_id": record.history_id}


@router.get("/history/{ticket_id}")
def get_maintenance_history(ticket_id: str, db: Session = Depends(get_db)):
    records = db.query(MaintenanceHistory).filter(
        MaintenanceHistory.ticket_id == ticket_id
    ).order_by(MaintenanceHistory.created_at.asc()).all()
    return {"ticket_id": ticket_id, "history": records}


@router.get("/history")
def get_all_history(db: Session = Depends(get_db)):
    records = db.query(MaintenanceHistory).order_by(MaintenanceHistory.created_at.desc()).limit(50).all()
    return {"data": records}


# ─── DRONE SURVEY ─────────────────────────────────────────────────────────────
class DroneRequest(BaseModel):
    center_lat: float
    center_lon: float
    radius_km: float = 2.0


@router.post("/drone-survey")
def run_drone_survey_endpoint(req: DroneRequest, db: Session = Depends(get_db)):
    detected = run_drone_survey(req.center_lat, req.center_lon, req.radius_km)
    created = 0
    for d in detected:
        if d["assessment"]["ai_confidence"] < 0.90:
            continue
        severity = d["assessment"]["ai_suggested_severity"]
        db.add(MasterTicket(
            ticket_id=str(uuid.uuid4()),
            latitude=d["location"]["latitude"],
            longitude=d["location"]["longitude"],
            duplicate_count=1,
            base_severity=severity,
            priority_score=calculate_priority(severity, 1, 5000, False, False),
            status="OPEN"
        ))
        created += 1
    db.commit()
    return {"status": "success", "mode": "simulation", "tickets_created": created}


# ─── SLA / FRAUD / BUDGET / WEATHER ───────────────────────────────────────────
@router.get("/sla")
def sla_report(db: Session = Depends(get_db)):
    return get_sla_report(db)


@router.get("/fraud")
def get_flagged(db: Session = Depends(get_db)):
    reports = db.query(RoadDamageReport).all()
    flagged = []
    for r in reports:
        result = calculate_fraud_score({"user_id": r.user_id, "location": {"latitude": r.latitude, "longitude": r.longitude}}, db)
        if result["is_suspicious"]:
            flagged.append({"report_id": r.report_id, "user_id": r.user_id, **result})
    return {"flagged_count": len(flagged), "data": flagged}


@router.get("/budget")
def get_budget(db: Session = Depends(get_db)):
    resolved = db.query(MasterTicket).filter(MasterTicket.status == "RESOLVED").count()
    total = max(db.query(MasterTicket).count(), 1)
    spent = resolved * 5000
    total_budget = 1_000_000
    return {
        "total_budget_inr": total_budget, "spent_inr": spent,
        "remaining_inr": total_budget - spent,
        "burn_rate_percent": round(spent / total_budget * 100, 1),
        "repairs_completed": resolved, "average_cost_per_repair": 5000
    }


@router.get("/weather")
def get_weather(lat: float = 19.076, lon: float = 72.877):
    return get_weather_forecast(lat, lon)


@router.get("/predictions/roads")
def get_failing_roads(db: Session = Depends(get_db)):
    from models.government import RoadSegment
    roads = db.query(RoadSegment).order_by(RoadSegment.predicted_days_to_failure.asc()).limit(10).all()
    return {"data": roads}
