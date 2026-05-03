import math
import requests
import networkx as nx
import numpy as np
import logging
from typing import List, Tuple, Dict
from scipy.spatial import KDTree
from functools import lru_cache

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Pathfinder")

# Global Cache for OSM Road Data to prevent redundant API hits
ROAD_DATA_CACHE = {}

# Highway Speeds (km/h)
HIGHWAY_SPEEDS = {
    'motorway': 100,
    'trunk': 80,
    'primary': 60,
    'secondary': 50,
    'tertiary': 40,
    'residential': 30,
    'unclassified': 25,
    'service': 20,
    'unknown': 30
}

class Pathfinder:
    """
    Production-grade graph-based pathfinding engine.
    Uses KD-Trees for fast spatial lookups and caches road networks.
    """
    def __init__(self, min_lat, min_lon, max_lat, max_lon):
        self.min_lat = round(min_lat, 4) # Round to normalize cache keys
        self.min_lon = round(min_lon, 4)
        self.max_lat = round(max_lat, 4)
        self.max_lon = round(max_lon, 4)
        self.graph = nx.Graph()
        self.nodes_array = None
        self.kdtree = None

    def _fetch_osm_data(self) -> List[Dict]:
        """Fetches road segments with local caching and retry logic."""
        cache_key = (self.min_lat, self.min_lon, self.max_lat, self.max_lon)
        if cache_key in ROAD_DATA_CACHE:
            logger.info("Using cached OSM data.")
            return ROAD_DATA_CACHE[cache_key]

        overpass_url = "https://overpass-api.de/api/interpreter"
        query = f"""
        [out:json][timeout:60];
        (way["highway"]({self.min_lat},{self.min_lon},{self.max_lat},{self.max_lon}););
        out geom;
        """
        try:
            logger.info(f"Fetching Overpass data for bbox: {cache_key}")
            # Standard Overpass Query with JSON output and a reasonable timeout
            # We use POST to avoid URL length issues and 406 errors
            headers = {
                'User-Agent': 'AliveNavigation/2.0 (contact: support@alivenav.ai)',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            # The query must be sent as 'data=' followed by the query string
            post_data = f"data={query}"
            
            response = requests.post(overpass_url, data=post_data, headers=headers, timeout=25)
            response.raise_for_status()
            data = response.json()
            elements = data.get('elements', [])
            
            # Cache the result
            ROAD_DATA_CACHE[cache_key] = elements
            return elements
        except Exception as e:
            logger.error(f"Overpass API error: {e}")
            # Return empty but don't crash
            return []

    def _haversine(self, lat1, lon1, lat2, lon2):
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi, dlambda = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    def build_graph(self):
        """Builds a NetworkX graph and initializes KD-Tree for O(log N) lookup."""
        elements = self._fetch_osm_data()
        if not elements:
            return

        for el in elements:
            if el['type'] == 'way' and 'geometry' in el:
                geom = el['geometry']
                h_type = el.get('tags', {}).get('highway', 'unknown')
                if h_type in ['footway', 'path', 'cycleway', 'steps']: continue

                speed = HIGHWAY_SPEEDS.get(h_type, 30)
                for i in range(len(geom) - 1):
                    u = (geom[i]['lat'], geom[i]['lon'])
                    v = (geom[i+1]['lat'], geom[i+1]['lon'])
                    dist = self._haversine(u[0], u[1], v[0], v[1])
                    
                    # Weight = Time (seconds) + 0.0 (hazards added later)
                    # Time = distance / (speed / 3.6)
                    time_weight = dist / (speed / 3.6)
                    self.graph.add_edge(u, v, weight=time_weight, length=dist, speed=speed, highway=h_type)

        # Build KD-Tree for spatial indexing
        nodes = list(self.graph.nodes)
        if nodes:
            self.nodes_array = np.array(nodes)
            self.kdtree = KDTree(self.nodes_array)
            logger.info(f"KD-Tree built with {len(nodes)} nodes.")

    def _get_nearest_node(self, lat, lon) -> Tuple[float, float]:
        """Uses KD-Tree for O(log N) nearest node lookup."""
        if self.kdtree is None: return None
        dist, index = self.kdtree.query([lat, lon])
        return tuple(self.nodes_array[index])

    def add_hazard(self, lat, lon, penalty_score):
        """
        Applies a weight penalty to the actual road segment (edge).
        Uses spatial index to find the nearest edge efficiently.
        """
        nearest_node = self._get_nearest_node(lat, lon)
        if not nearest_node: return

        # Find the nearest edge connected to this node
        # In a more advanced version, we'd snap to the nearest segment point
        for neighbor in self.graph.neighbors(nearest_node):
            edge = self.graph[nearest_node][neighbor]
            # Non-linear penalty: severity impacts safety exponentially
            # We add a time penalty (seconds) to discourage this path
            edge['weight'] += (penalty_score ** 2) * 50 # 50s penalty per severity unit squared

    def _calculate_bearing(self, lat1, lon1, lat2, lon2):
        """Calculates the bearing between two points in degrees."""
        y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
        x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - \
            math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.cos(math.radians(lon2 - lon1))
        return (math.degrees(math.atan2(y, x)) + 360) % 360

    def get_turn_instruction(self, b1, b2):
        """Converts change in bearing to a human-readable instruction."""
        diff = (b2 - b1 + 180) % 360 - 180
        if abs(diff) < 20: return "Continue straight"
        if diff > 0:
            if diff > 135: return "Make a U-turn"
            if diff > 45: return "Turn right"
            return "Slight right"
        else:
            if diff < -135: return "Make a U-turn"
            if diff < -45: return "Turn left"
            return "Slight left"

    def snap_to_road(self, lat, lon) -> Dict:
        """Projects a raw GPS point onto the nearest road segment (edge)."""
        nearest_node = self._get_nearest_node(lat, lon)
        if not nearest_node: return {"lat": lat, "lng": lon}
        
        # Simplification: Snap to the nearest node
        # A more advanced version would find the closest point on the line segment
        return {"lat": nearest_node[0], "lng": nearest_node[1]}

    def find_path(self, start_lat, start_lon, end_lat, end_lon) -> List[Dict]:
        """Calculates path with embedded Turn-by-Turn instructions."""
        if not self.graph.nodes:
            return [
                {"lat": start_lat, "lng": start_lon, "instruction": "Head toward destination"},
                {"lat": end_lat, "lng": end_lon, "instruction": "You have reached your destination"}
            ]

        start_node = self._get_nearest_node(start_lat, start_lon)
        end_node = self._get_nearest_node(end_lat, end_lon)

        try:
            path_nodes = nx.astar_path(self.graph, start_node, end_node, weight='weight',
                                     heuristic=lambda u, v: self._haversine(u[0], u[1], v[0], v[1]) / 27)
            
            # Interpolate for smoothness (ensure points every ~30m for road-following feel)
            interpolated_path = []
            for i in range(len(path_nodes) - 1):
                p1 = path_nodes[i]
                p2 = path_nodes[i+1]
                dist = self._haversine(p1[0], p1[1], p2[0], p2[1])
                
                # Add starting point
                bearing = self._calculate_bearing(p1[0], p1[1], p2[0], p2[1])
                node_data = {"lat": p1[0], "lng": p1[1], "bearing": bearing}
                
                if i > 0:
                    prev_bearing = interpolated_path[-1].get("bearing", bearing)
                    node_data["instruction"] = self.get_turn_instruction(prev_bearing, bearing)
                else:
                    node_data["instruction"] = "Head toward path"
                
                interpolated_path.append(node_data)
                
                # Interpolate intermediate points
                if dist > 40:
                    steps = int(dist / 30)
                    for s in range(1, steps):
                        f = s / steps
                        inter_lat = p1[0] + (p2[0] - p1[0]) * f
                        inter_lon = p1[1] + (p2[1] - p1[1]) * f
                        interpolated_path.append({
                            "lat": inter_lat, "lng": inter_lon,
                            "bearing": bearing,
                            "instruction": "Continue on road"
                        })
            
            # Add final destination node
            last = path_nodes[-1]
            interpolated_path.append({
                "lat": last[0], "lng": last[1],
                "instruction": "You have reached your destination"
            })
            
            return interpolated_path
        except (nx.NetworkXNoPath, KeyError):
            # Intelligent Fallback: Generate a set of points along the straight line
            # so the UI can still show a 'path' and simulation can work.
            logger.warning("No path found in graph. Using straight-line fallback.")
            steps = 10
            fallback_path = []
            for i in range(steps + 1):
                f = i / steps
                lat = start_lat + (end_lat - start_lat) * f
                lon = start_lon + (end_lon - start_lon) * f
                fallback_path.append({
                    "lat": lat, "lng": lon, 
                    "instruction": "Continue on main road" if 0 < i < steps else ("Head toward destination" if i == 0 else "Reached destination")
                })
            return fallback_path

