import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime
from database import Base

class MasterTicket(Base):
    __tablename__ = "master_tickets"

    ticket_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Coordinates (Center of the merged reports)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Aggregated Stats
    duplicate_count = Column(Integer, default=1)
    base_severity = Column(Float, default=1.0)
    
    # AI Calculated
    priority_score = Column(Float, default=0.0)
    
    # Clustering / Routing
    cluster_id = Column(String, index=True)
    status = Column(String, default="OPEN") # OPEN, IN_PROGRESS, RESOLVED

class TicketCluster(Base):
    __tablename__ = "ticket_clusters"
    
    cluster_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    center_lat = Column(Float)
    center_lon = Column(Float)
    
    ticket_count = Column(Integer, default=0)
    estimated_repair_hours = Column(Float, default=0.0)
    assigned_crew_id = Column(String)

class RoadSegment(Base):
    __tablename__ = "road_segments"
    
    segment_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    
    # Features for Predictive Maintenance Model
    days_since_last_resurfacing = Column(Integer, default=0)
    historical_patch_count = Column(Integer, default=0)
    aadt_traffic_volume = Column(Float, default=1000.0)
    heavy_vehicle_percentage = Column(Float, default=0.05)
    
    base_material_type = Column(String) # ASPHALT, CONCRETE
    
    predicted_days_to_failure = Column(Integer)
