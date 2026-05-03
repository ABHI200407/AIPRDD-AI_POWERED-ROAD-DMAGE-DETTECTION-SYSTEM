import sqlite3
import uuid
import datetime
import random

# Connect to the database
conn = sqlite3.connect('road_safety.db')
cursor = conn.cursor()

# Hyderabad Coordinates (Jubilee Hills, HITEC City, etc.)
HYD_POINTS = [
    (17.4299, 78.4127, "MAJOR_POTHOLE", 5), # Jubilee Hills
    (17.4435, 78.3772, "UNEVEN_SURFACE", 3), # HITEC City
    (17.4483, 78.3915, "CRACK", 2),         # Madhapur
    (17.4933, 78.3914, "POTHOLE", 4),       # Kukatpally
    (17.3850, 78.4867, "MAJOR_POTHOLE", 5), # Koti
    (17.4399, 78.4983, "POTHOLE", 3),       # Secunderabad
    (17.4123, 78.4321, "CRACK", 2),         # Banjara Hills
]

def seed():
    print("Seeding Hyderabad hazard data...")
    for lat, lon, d_type, sev in HYD_POINTS:
        report_id = str(uuid.uuid4())
        user_id = "hyd_init_user"
        timestamp = datetime.datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO road_damage_reports 
            (report_id, user_id, timestamp_captured, latitude, longitude, damage_type, ai_suggested_severity, user_confirmed_severity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (report_id, user_id, timestamp, lat, lon, d_type, sev, sev))
        
    conn.commit()
    print(f"Successfully added {len(HYD_POINTS)} hazards in Hyderabad!")

if __name__ == "__main__":
    seed()
    conn.close()
