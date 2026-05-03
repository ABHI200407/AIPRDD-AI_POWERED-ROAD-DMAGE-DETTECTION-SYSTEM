import sqlite3
import uuid
import random
from datetime import datetime, timedelta, timezone

DB_PATH = 'road_safety.db'

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create tables if they don't exist (in case main.py hasn't been run)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS road_damage_reports (
        report_id TEXT PRIMARY KEY, user_id TEXT, timestamp_captured DATETIME,
        latitude REAL, longitude REAL, accuracy_meters REAL, heading REAL,
        raw_image_url TEXT, ml_cropped_image_url TEXT, video_clip_url TEXT,
        speed_kmh REAL, g_force_z REAL, g_force_x REAL, damage_type TEXT,
        ai_suggested_severity INTEGER, user_confirmed_severity INTEGER,
        points_earned INTEGER, badge_progress_id TEXT, is_first_reporter BOOLEAN,
        is_duplicate BOOLEAN, master_ticket_id TEXT, road_segment_name TEXT,
        fraud_score REAL, is_flagged BOOLEAN, source TEXT
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS master_tickets (
        ticket_id TEXT PRIMARY KEY, created_at DATETIME,
        latitude REAL, longitude REAL, duplicate_count INTEGER,
        base_severity REAL, priority_score REAL, cluster_id TEXT, status TEXT
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS maintenance_history (
        history_id TEXT PRIMARY KEY, ticket_id TEXT, road_name TEXT,
        latitude REAL, longitude REAL, action TEXT, performed_by TEXT,
        notes TEXT, cost_inr REAL, before_image_url TEXT, after_image_url TEXT,
        created_at DATETIME
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS road_segments (
        segment_id TEXT PRIMARY KEY, name TEXT,
        days_since_last_resurfacing INTEGER, historical_patch_count INTEGER,
        aadt_traffic_volume REAL, heavy_vehicle_percentage REAL,
        base_material_type TEXT, predicted_days_to_failure INTEGER
    )""")

    # Clear existing data
    cursor.execute("DELETE FROM road_damage_reports")
    cursor.execute("DELETE FROM master_tickets")
    cursor.execute("DELETE FROM maintenance_history")
    cursor.execute("DELETE FROM road_segments")

    # Add Reports
    types = ['POTHOLE', 'CRACK', 'FADED_MARKINGS', 'DRAINAGE_ISSUE', 'STREET_LIGHT_OUT']
    users = ['user_123', 'user_456', 'user_789', 'citizen_001']
    for i in range(40):
        lat = 19.076 + random.uniform(-0.03, 0.03)
        lon = 72.877 + random.uniform(-0.03, 0.03)
        cursor.execute("INSERT INTO road_damage_reports VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            str(uuid.uuid4()), random.choice(users), datetime.now(timezone.utc).isoformat(),
            lat, lon, 5.0, 0.0, 'https://picsum.photos/400/300', 'https://picsum.photos/200/200', None,
            0.0, 0.0, 0.0, random.choice(types), random.randint(1, 5), random.randint(1, 5),
            20, None, False, False, None, "Main St Section A", 0.0, False, "CITIZEN"
        ))

    # Add Master Tickets
    for i in range(12):
        lat = 19.076 + random.uniform(-0.03, 0.03)
        lon = 72.877 + random.uniform(-0.03, 0.03)
        cursor.execute("INSERT INTO master_tickets VALUES (?,?,?,?,?,?,?,?,?)", (
            str(uuid.uuid4()), (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 5))).isoformat(),
            lat, lon, random.randint(1, 8), random.uniform(1, 5), random.uniform(20, 98),
            None, random.choice(['OPEN', 'IN_PROGRESS', 'RESOLVED'])
        ))

    # Add History
    for i in range(15):
        cursor.execute("INSERT INTO maintenance_history VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (
            str(uuid.uuid4()), str(uuid.uuid4()), "Harbor Road", 19.076, 72.877,
            random.choice(['PATCHED', 'INSPECTED', 'RESURFACED']), 'CREW_A',
            "Completed early", random.uniform(5000, 25000), 'https://picsum.photos/200', 'https://picsum.photos/200',
            (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat()
        ))

    # Add Road Segments
    roads = ['Western Express Hwy', 'SV Road', 'Link Road', 'Marine Drive', 'Eastern Freeway']
    for name in roads:
        cursor.execute("INSERT INTO road_segments VALUES (?,?,?,?,?,?,?,?)", (
            str(uuid.uuid4()), name, random.randint(0, 500), random.randint(0, 50),
            random.uniform(5000, 50000), 0.1, 'ASPHALT', random.randint(10, 365)
        ))

    conn.commit()
    conn.close()
    print("Seed successful!")

if __name__ == '__main__':
    seed()
