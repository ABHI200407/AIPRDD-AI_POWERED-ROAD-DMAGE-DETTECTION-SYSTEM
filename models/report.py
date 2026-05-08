import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text
from database import Base


class RoadDamageReport(Base):
    __tablename__ = "road_damage_reports"

    report_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    timestamp_captured = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy_meters = Column(Float)
    heading = Column(Float)

    raw_image_url = Column(String)
    ml_cropped_image_url = Column(String)
    video_clip_url = Column(String)

    speed_kmh = Column(Float)
    g_force_z = Column(Float)
    g_force_x = Column(Float)

    damage_type = Column(String)
    ai_suggested_severity = Column(Integer)
    user_confirmed_severity = Column(Integer)

    points_earned = Column(Integer, default=0)
    badge_progress_id = Column(String)
    is_first_reporter = Column(Boolean, default=False)

    is_duplicate = Column(Boolean, default=False)
    master_ticket_id = Column(String, index=True)

    # Road health / maintenance
    road_segment_name = Column(String)
    fraud_score = Column(Float, default=0.0)
    is_flagged = Column(Boolean, default=False)
    source = Column(String, default="CITIZEN")  # CITIZEN | DRONE_AI | ACCELEROMETER | LIDAR | SENTINEL
    
    # Sentinel Elite Features
    area_name = Column(String)  # Neighborhood (Hitech City, Abids, etc.)
    is_impact_verified = Column(Boolean, default=False) # Vision + Vibration match
    verification_count = Column(Integer, default=0)
    fixed_confirmation_count = Column(Integer, default=0)


class MaintenanceHistory(Base):
    """Tracks every repair/inspection event on a specific location"""
    __tablename__ = "maintenance_history"

    history_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String, index=True)
    road_name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)

    action = Column(String)  # REPORTED | INSPECTED | PATCHED | RESURFACED | CLOSED
    performed_by = Column(String)  # crew_id or SYSTEM
    notes = Column(Text)
    cost_inr = Column(Float, default=0.0)
    before_image_url = Column(String)
    after_image_url = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
