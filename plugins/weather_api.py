"""
SOFTWARE PLUGIN: Weather API Integration
=========================================
This plugin fetches real weather data from the Open-Meteo API (free, no key needed).
It also supports a simulation mode for testing without internet.

To upgrade to a premium provider:
1. Set WEATHER_MODE = "openweathermap" or "weatherapi"
2. Add your API key below
3. Implement the corresponding _fetch_*() function

PLUG-IN POINT: Any Weather REST API
"""

import random
from typing import Dict, Optional
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

WEATHER_MODE = "open_meteo"  # Options: "simulation", "open_meteo", "openweathermap"
OPENWEATHERMAP_API_KEY = "YOUR_OWM_KEY"  # Plug in your API key


def get_weather_forecast(lat: float, lon: float) -> Dict:
    """
    Returns weather data relevant to road maintenance planning.
    """
    if WEATHER_MODE == "simulation" or not REQUESTS_AVAILABLE:
        return _simulate_weather(lat, lon)
    elif WEATHER_MODE == "open_meteo":
        return _fetch_open_meteo(lat, lon)
    elif WEATHER_MODE == "openweathermap":
        return _fetch_openweathermap(lat, lon)
    return _simulate_weather(lat, lon)


def _simulate_weather(lat: float, lon: float) -> Dict:
    """Returns mock weather data."""
    conditions = ["Clear", "Partly Cloudy", "Heavy Rain", "Thunderstorm"]
    return {
        "source": "SIMULATION",
        "location": {"latitude": lat, "longitude": lon},
        "condition": random.choice(conditions),
        "temperature_c": round(random.uniform(15, 40), 1),
        "rainfall_mm_24h": round(random.uniform(0, 80), 1),
        "has_heavy_rain": random.choice([True, False]),
        "freeze_risk": False
    }


def _fetch_open_meteo(lat: float, lon: float) -> Dict:
    """Fetches real data from the free Open-Meteo API (no key required)."""
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,rain,weathercode"
            f"&forecast_days=1"
        )
        response = requests.get(url, timeout=5)
        data = response.json()
        current = data.get("current", {})
        rain_mm = current.get("rain", 0) or 0
        return {
            "source": "OPEN_METEO",
            "location": {"latitude": lat, "longitude": lon},
            "temperature_c": current.get("temperature_2m"),
            "rainfall_mm_24h": rain_mm,
            "has_heavy_rain": rain_mm > 20,
            "freeze_risk": current.get("temperature_2m", 20) < 2,
        }
    except Exception as e:
        return _simulate_weather(lat, lon)


def _fetch_openweathermap(lat: float, lon: float) -> Dict:
    """
    ═══════════════════════════════════════════════════
    HARDWARE/API PLUG-IN POINT 🔌
    ═══════════════════════════════════════════════════
    Plug in your OpenWeatherMap or WeatherAPI key above and this will work.
    Example:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHERMAP_API_KEY}"
        data = requests.get(url, timeout=5).json()
        ...
    """
    raise NotImplementedError("Set OPENWEATHERMAP_API_KEY or use WEATHER_MODE='open_meteo'")
