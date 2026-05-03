"""
HARDWARE PLUGIN INTERFACE: Accelerometer & Dashcam
====================================================
This module handles auto-detection of road damage via vehicle-mounted sensors.
In simulation mode, it generates synthetic G-force data.

To connect real hardware:
1. Set ACCEL_MODE = "live" 
2. On Android/iOS, this maps to the DeviceMotion API or native accelerometer SDK
3. For OBD-II dashcam systems, replace _live_read() with your CAN bus reader

PLUG-IN POINT: Mobile SDK → Capacitor / React Native / OBD-II API
"""

import random
from typing import Dict, Optional
from datetime import datetime, timezone

ACCEL_MODE = "simulation"  # Options: "simulation", "capacitor_js", "obd2_api"
ACCEL_THRESHOLD_MS2 = 9.8 * 0.4  # 0.4G vertical force triggers detection

OBD2_API_ENDPOINT = "http://your-obd2-device/accelerometer"  # Plug in OBD-II API URL


def read_impact_event() -> Optional[Dict]:
    """
    Reads an accelerometer impact event.
    Returns structured data if an impact above threshold is detected.
    """
    if ACCEL_MODE == "simulation":
        return _simulate_impact()
    return None

def process_raw_sensor_data(data: Dict) -> Optional[Dict]:
    """
    ═══════════════════════════════════════════════════
    REAL-TIME SENSOR PROCESSING 📶
    ═══════════════════════════════════════════════════
    Receives raw vibration data from the Citizen App (DeviceMotion API)
    and determines if a hazard was struck.
    """
    g_z = data.get('g_force_z', 0)
    # Threshold check (e.g. 0.4G vertical impact)
    if abs(g_z) > (ACCEL_THRESHOLD_MS2 / 9.8):
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": data.get("source", "MOBILE_SENSOR"),
            "speed_kmh": data.get("speed_kmh"),
            "g_force_z": g_z,
            "triggered": True
        }
    return None


def _simulate_impact() -> Optional[Dict]:
    """Generates a mock high-G impact event for testing."""
    triggered = random.random() > 0.7  # 30% chance of detecting an event
    if not triggered:
        return None
    g_z = round(random.uniform(-4.0, -1.5), 3)  # Downward vertical force
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "SIMULATED_ACCELEROMETER",
        "speed_kmh": random.uniform(20, 80),
        "g_force_z": g_z,
        "g_force_x": round(random.uniform(-0.5, 0.5), 3),
        "triggered": abs(g_z) > (ACCEL_THRESHOLD_MS2 / 9.8)
    }


def _live_obd2_read() -> Optional[Dict]:
    """
    ═══════════════════════════════════════════════════
    HARDWARE PLUG-IN POINT 🔌
    ═══════════════════════════════════════════════════
    Replace this body with your OBD-II / CAN bus SDK call.
    Example:
        import requests
        data = requests.get(OBD2_API_ENDPOINT, timeout=1).json()
        if abs(data['g_force_z']) > ACCEL_THRESHOLD_MS2 / 9.8:
            return data
    """
    raise NotImplementedError("OBD-II device not connected. Set ACCEL_MODE='simulation'.")

def simulate_drive_over(ticket_id: str, is_smooth: bool = True) -> Dict:
    """
    Simulates driving over a known pothole for Shadow Verification.
    If is_smooth=True, simulates a flatline (hazard is fixed).
    """
    g_z = round(random.uniform(-0.2, 0.2), 3) if is_smooth else round(random.uniform(-4.0, -1.5), 3)
    return {
        "ticket_id": ticket_id,
        "g_force_z": g_z,
        "speed_kmh": random.uniform(30, 60)
    }
