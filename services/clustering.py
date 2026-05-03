import numpy as np
from sklearn.cluster import DBSCAN
from typing import List, Tuple, Dict

def perform_geo_clustering(coordinates: List[Tuple[float, float]], eps_meters: float = 500.0, min_samples: int = 3) -> List[int]:
    """
    Groups coordinates into clusters using DBSCAN.
    eps_meters: max distance between points to be considered neighbors.
    min_samples: minimum points to form a cluster.
    """
    if not coordinates:
        return []
        
    coords_rad = np.radians(coordinates)
    earth_radius = 6371000.0
    eps_rad = eps_meters / earth_radius
    
    db = DBSCAN(eps=eps_rad, min_samples=min_samples, algorithm='ball_tree', metric='haversine')
    db.fit(coords_rad)
    
    return db.labels_.tolist()

def calculate_cluster_center(coordinates: List[Tuple[float, float]]) -> Tuple[float, float]:
    """Calculates the center of mass for a cluster"""
    if not coordinates:
        return 0.0, 0.0
    avg_lat = sum(c[0] for c in coordinates) / len(coordinates)
    avg_lon = sum(c[1] for c in coordinates) / len(coordinates)
    return avg_lat, avg_lon
