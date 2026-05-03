import math

def calculate_priority(base_severity: float, duplicate_count: int, traffic_volume: float, is_near_school: bool, has_bad_weather: bool) -> float:
    """
    Implements the multi-factor scoring algorithm defined in the technical spec.
    Priority = (W_s*S + W_t*T + W_u*U) * ZoneBoost * WeatherBoost
    """
    # Normalize inputs to 0.0 - 1.0 range (simplified for mock)
    S = min(base_severity / 5.0, 1.0)  # Severity 1-5
    T = min(traffic_volume / 10000.0, 1.0) # Traffic (e.g. 10k AADT = 1.0)
    U = min(duplicate_count / 10.0, 1.0)   # Up to 10 duplicates
    
    # Weights
    W_s = 0.50
    W_t = 0.30
    W_u = 0.20
    
    # Base Score
    base_score = (W_s * S) + (W_t * T) + (W_u * U)
    
    # Boosts
    B_z = 1.5 if is_near_school else 1.0
    B_w = 1.3 if has_bad_weather else 1.0
    
    # Final Score (Scaled to 0-100)
    final_score = (base_score * B_z * B_w) * 100
    
    return min(final_score, 100.0) # Cap at 100
