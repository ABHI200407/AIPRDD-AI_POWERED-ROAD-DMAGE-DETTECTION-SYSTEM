from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.government import MasterTicket
from services.websocket_manager import manager

router = APIRouter(prefix="/api/v1/telemetry", tags=["Telemetry"])

class AccelerometerData(BaseModel):
    ticket_id: str
    g_force_z: float
    speed_kmh: float

@router.post("/accelerometer")
async def process_telemetry(data: AccelerometerData, db: Session = Depends(get_db)):
    """
    Shadow Verification Endpoint.
    If vibration (g_force_z) is below threshold over a known ticket, decrement severity.
    """
    VIBRATION_THRESHOLD = 0.5 # Anything below 0.5G is considered a "flatline" (no pothole)
    
    ticket = db.query(MasterTicket).filter(MasterTicket.ticket_id == data.ticket_id).first()
    if not ticket:
        return {"status": "error", "message": "Ticket not found"}

    if abs(data.g_force_z) < VIBRATION_THRESHOLD:
        # Shadow verification triggered! Decrement severity
        if ticket.base_severity > 1:
            ticket.base_severity -= 1
        else:
            ticket.status = "RESOLVED"
            ticket.priority_score = 0.0
            
        db.commit()
        db.refresh(ticket)
        
        # Broadcast the fix
        await manager.broadcast({
            "type": "SHADOW_VERIFICATION", 
            "ticket_id": ticket.ticket_id, 
            "new_severity": ticket.base_severity,
            "status": ticket.status
        })
        
        return {
            "status": "success", 
            "message": "Shadow verification applied", 
            "new_severity": ticket.base_severity, 
            "ticket_status": ticket.status
        }
        
    return {"status": "ignored", "message": "Significant vibration detected, hazard remains."}
