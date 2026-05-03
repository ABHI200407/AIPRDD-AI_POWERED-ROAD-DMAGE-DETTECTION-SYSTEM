import sqlite3
import uuid
import datetime
import random

# Connect to the database
conn = sqlite3.connect('road_safety.db')
cursor = conn.cursor()

# Metro Green Line Path (Approximate coordinates)
# JBS to MGBS route
METRO_PATH = [
    (17.4475, 78.5000), # JBS
    (17.4390, 78.4985), # Secunderabad
    (17.4245, 78.4940), # Musheerabad
    (17.4115, 78.4925), # RTC X Roads
    (17.4040, 78.4910), # Chikkadpally
    (17.3976, 78.4891), # Narayanguda
    (17.3910, 78.4830), # Sultan Bazar
    (17.3820, 78.4800), # MGBS
    (17.3911, 78.4772), # Abids area
]

def generate_points(path, count=25):
    points = []
    for _ in range(count):
        # Pick a random segment in the path
        idx = random.randint(0, len(path) - 2)
        start = path[idx]
        end = path[idx+1]
        
        # Interpolate a random point between start and end
        t = random.random()
        lat = start[0] + (end[0] - start[0]) * t
        lon = start[1] + (end[1] - start[1]) * t
        
        # Add slight jitter
        lat += random.uniform(-0.0005, 0.0005)
        lon += random.uniform(-0.0005, 0.0005)
        
        d_type = random.choice(["POTHOLE", "CRACK", "MAJOR_POTHOLE", "UNEVEN_SURFACE"])
        sev = random.randint(2, 5)
        points.append((lat, lon, d_type, sev))
    return points

def seed():
    print("Seeding Hyderabad Metro Green Line (Narayanguda/Abids)...")
    points = generate_points(METRO_PATH, 25)
    for lat, lon, d_type, sev in points:
        report_id = str(uuid.uuid4())
        user_id = "metro_sync_bot"
        timestamp = datetime.datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO road_damage_reports 
            (report_id, user_id, timestamp_captured, latitude, longitude, damage_type, ai_suggested_severity, user_confirmed_severity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (report_id, user_id, timestamp, lat, lon, d_type, sev, sev))
        
    conn.commit()
    print(f"Successfully added {len(points)} hazards along the Metro Green Line!")

if __name__ == "__main__":
    seed()
    conn.close()
