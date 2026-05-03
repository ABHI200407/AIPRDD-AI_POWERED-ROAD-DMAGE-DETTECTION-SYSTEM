"""
SLA Monitoring Service
=======================
Tracks response time SLAs and detects breaches.
"""

from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from models.government import MasterTicket

# SLA targets in hours per severity level
SLA_HOURS = {
    5: 8,    # Critical: fix within 8 hours
    4: 24,   # Severe: fix within 24 hours
    3: 72,   # Moderate: fix within 72 hours
    2: 168,  # Minor: fix within 1 week
    1: 336,  # Cosmetic: fix within 2 weeks
}


def get_sla_report(db: Session) -> dict:
    """
    Returns a full SLA compliance report for all open tickets.
    """
    tickets = db.query(MasterTicket).filter(MasterTicket.status != "RESOLVED").all()
    now = datetime.now(timezone.utc)
    breached = []
    at_risk = []
    on_track = []

    for ticket in tickets:
        severity = int(ticket.base_severity or 3)
        sla_hours = SLA_HOURS.get(severity, 72)
        deadline = ticket.created_at.replace(tzinfo=timezone.utc) + timedelta(hours=sla_hours)
        time_remaining_hours = (deadline - now).total_seconds() / 3600

        entry = {
            "ticket_id": ticket.ticket_id,
            "severity": severity,
            "status": ticket.status,
            "sla_deadline": deadline.isoformat(),
            "hours_remaining": round(time_remaining_hours, 1),
        }

        if time_remaining_hours < 0:
            entry["sla_status"] = "BREACHED"
            breached.append(entry)
        elif time_remaining_hours < sla_hours * 0.25:  # Last 25% of time window
            entry["sla_status"] = "AT_RISK"
            at_risk.append(entry)
        else:
            entry["sla_status"] = "ON_TRACK"
            on_track.append(entry)

    return {
        "total_tickets": len(tickets),
        "breached": breached,
        "at_risk": at_risk,
        "on_track": on_track,
        "compliance_rate": round(len(on_track) / max(len(tickets), 1) * 100, 1)
    }
