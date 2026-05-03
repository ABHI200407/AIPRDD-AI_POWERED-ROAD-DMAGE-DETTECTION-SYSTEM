"""
Gamification Engine
====================
Calculates points earned per report and tracks badge progression.
"""

POINTS_PER_REPORT = 10
POINTS_BONUS_FIRST_REPORTER = 25
POINTS_BONUS_HIGH_SEVERITY = 15  # Severity >= 4

BADGES = [
    {"id": "newcomer",       "name": "Road Watcher",     "min_points": 0,    "icon": "👀"},
    {"id": "active_reporter","name": "Road Reporter",    "min_points": 100,  "icon": "📱"},
    {"id": "road_guardian",  "name": "Road Guardian",    "min_points": 250,  "icon": "🛡️"},
    {"id": "safety_champion","name": "Safety Champion",  "min_points": 500,  "icon": "🏆"},
    {"id": "weekly_hero",    "name": "Weekly Hero",      "min_points": 750,  "icon": "⭐"},
    {"id": "city_guardian",  "name": "City Guardian",    "min_points": 1000, "icon": "🌆"},
]


def calculate_points(severity: int, is_first_reporter: bool) -> int:
    """Returns total points earned for a submitted report."""
    pts = POINTS_PER_REPORT
    if is_first_reporter:
        pts += POINTS_BONUS_FIRST_REPORTER
    if severity >= 4:
        pts += POINTS_BONUS_HIGH_SEVERITY
    return pts


def get_current_badge(total_points: int) -> dict:
    """Returns the highest badge the user has earned."""
    earned = [b for b in BADGES if total_points >= b["min_points"]]
    return earned[-1] if earned else BADGES[0]


def get_next_badge(total_points: int) -> dict | None:
    """Returns the next badge the user is working toward."""
    upcoming = [b for b in BADGES if total_points < b["min_points"]]
    return upcoming[0] if upcoming else None
