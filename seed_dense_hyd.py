import sqlite3
import uuid
import datetime
import random

# Connect to the database
conn = sqlite3.connect('road_safety.db')
cursor = conn.cursor()

# User's approx location in Hyderabad (from logs)
USER_LAT = 17.3850 
USER_LON = 78.4867

def generate_dense_points(center_lat, center_lon, count=100, radius=0.05):
    points = []
    for _ in range(count):
        # Random point within radius
        lat = center_lat + random.uniform(-radius, radius)
        lon = center_lon + random.uniform(-radius, radius)
        
        d_type = random.choice(["POTHOLE", "CRACK", "MAJOR_POTHOLE", "UNEVEN_SURFACE", "PATCH_REPAIR"])
        sev = random.randint(1, 5)
        points.append((lat, lon, d_type, sev))
    return points

def seed():
    print(f"Seeding 100 hazards around Hyderabad ({USER_LAT}, {USER_LON})...")
    points = generate_dense_points(USER_LAT, USER_LON, 100, 0.04)
    for lat, lon, d_type, sev in points:
        report_id = str(uuid.uuid4())
        user_id = "dense_seed_bot"
        timestamp = datetime.datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO road_damage_reports 
            (report_id, user_id, timestamp_captured, latitude, longitude, damage_type, ai_suggested_severity, user_confirmed_severity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (report_id, user_id, timestamp, lat, lon, d_type, sev, sev))
        
    conn.commit()
    print(f"Successfully added {len(points)} dense hazards for testing!")

if __name__ == "__main__":
    seed()
    conn.close()
