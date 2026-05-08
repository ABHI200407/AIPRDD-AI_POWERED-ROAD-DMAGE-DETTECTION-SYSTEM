from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
from models.report import RoadDamageReport, MaintenanceHistory
from models.government import MasterTicket, TicketCluster, RoadSegment
import uuid
import random
from datetime import datetime, timedelta, timezone

def seed():
    # Create tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    # Add Reports
    types = ['POTHOLE', 'CRACK', 'FADED_MARKINGS', 'DRAINAGE_ISSUE', 'STREET_LIGHT_OUT']
    areas = ['Hitech City', 'Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'Kondapur', 'Madhapur']
    users = ['user_123', 'user_456', 'user_789', 'citizen_001']
    
    for i in range(40):
        lat = 17.3850 + random.uniform(-0.05, 0.05) # Hyderabad-centric
        lon = 78.4867 + random.uniform(-0.05, 0.05)
        report = RoadDamageReport(
            report_id=str(uuid.uuid4()),
            user_id=random.choice(users),
            timestamp_captured=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 72)),
            latitude=lat,
            longitude=lon,
            accuracy_meters=5.0,
            damage_type=random.choice(types),
            ai_suggested_severity=random.randint(1, 5),
            user_confirmed_severity=random.randint(1, 5),
            points_earned=20,
            source="CITIZEN",
            area_name=random.choice(areas),
            is_impact_verified=random.choice([True, False])
        )
        db.add(report)

    # Add Master Tickets
    for i in range(17):
        lat = 17.3850 + random.uniform(-0.05, 0.05)
        lon = 78.4867 + random.uniform(-0.05, 0.05)
        ticket = MasterTicket(
            ticket_id=str(uuid.uuid4()),
            created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 5)),
            latitude=lat,
            longitude=lon,
            duplicate_count=random.randint(1, 8),
            base_severity=random.uniform(1, 5),
            priority_score=random.uniform(20, 98),
            status=random.choice(['OPEN', 'IN_PROGRESS', 'RESOLVED'])
        )
        db.add(ticket)

    # Add Road Segments
    roads = ['Outer Ring Road', 'Hitech City Flyover', 'Raj Bhavan Rd', 'KBR Park Loop', 'Financial District Way']
    for name in roads:
        segment = RoadSegment(
            segment_id=str(uuid.uuid4()),
            name=name,
            days_since_last_resurfacing=random.randint(0, 500),
            historical_patch_count=random.randint(0, 50),
            aadt_traffic_volume=random.uniform(5000, 50000),
            heavy_vehicle_percentage=0.1,
            base_material_type='ASPHALT',
            predicted_days_to_failure=random.randint(10, 365)
        )
        db.add(segment)

    db.commit()
    db.close()
    print("Seed successful (SQLAlchemy version)!")

if __name__ == '__main__':
    seed()
