"""
JalRakshak Geospatial Boundary Validation Service
Restricted strictly to the Mumbai Operational Territory (BMC Municipal Area + Tidal Waterways).
"""

from typing import Dict, Any, Optional, Tuple, List
from shapely.geometry import Point, Polygon
import math

# Approved Mumbai Operational Boundary Polygon (Coordinates in [Latitude, Longitude])
# Encompasses Greater Mumbai (Island City + Suburban District) including:
# - Colaba & Apollo Bunder in the south
# - Mahul, Trombay & Thane Creek outfalls in the east
# - Vashi Creek / Mankhurd boundary
# - Bhandup, Kanjurmarg, Mulund along Thane Creek
# - SGNP western ridge to Dahisar Check Naka in the north
# - Gorai Creek, Manori Creek, Malad Creek, Versova, Mahim Bay in the west
MUMBAI_OPERATIONAL_BOUNDARY_COORDS: List[Tuple[float, float]] = [
    (18.8920, 72.8050),  # Colaba Point / Prongs Reef
    (18.9050, 72.8250),  # Colaba East Waterfront
    (18.9220, 72.8340),  # Apollo Bunder / Gateway of India
    (18.9600, 72.8550),  # Mazagon Docks / Sewri
    (19.0050, 72.8750),  # Wadala Salt Pans / Mahul Creek
    (19.0150, 72.9050),  # Trombay / BARC coastal boundary
    (19.0400, 72.9300),  # Trombay Mahul Outfall
    (19.0700, 72.9450),  # Mankhurd / Vashi Creek Bridge west edge
    (19.1000, 72.9600),  # Ghatkopar East / Thane Creek mudflats
    (19.1450, 72.9680),  # Bhandup Pumping Station & Creek
    (19.1750, 72.9750),  # Mulund East Creek border
    (19.1950, 72.9550),  # Mulund West (T-Ward boundary)
    (19.2250, 72.9050),  # SGNP Eastern Ridge / Kanheri
    (19.2550, 72.8650),  # Dahisar Check Naka (Northern Mumbai limit)
    (19.2500, 72.8350),  # Dahisar Creek / Gorai Creek entrance
    (19.2350, 72.7850),  # Gorai Beach / Manori Creek West
    (19.1950, 72.7800),  # Madh Island & Marve Creek mouth
    (19.1450, 72.7950),  # Versova Beach / Malad Creek outfall
    (19.1050, 72.8150),  # Juhu Beach / Koliwada outfall
    (19.0450, 72.8180),  # Bandra West / Bandstand
    (19.0350, 72.8350),  # Mahim Bay / Mithi River mouth
    (18.9950, 72.8100),  # Worli Seaface / Love Grove outfall
    (18.9600, 72.7950),  # Malabar Hill / Banganga
    (18.9350, 72.8050),  # Nariman Point / Marine Drive
    (18.8920, 72.8050),  # Close boundary at Colaba Point
]

# Create Shapely Polygon (Note: Shapely uses (x, y) = (lon, lat))
_polygon_xy = [(lon, lat) for lat, lon in MUMBAI_OPERATIONAL_BOUNDARY_COORDS]
MUMBAI_POLYGON = Polygon(_polygon_xy)

def validate_mumbai_coordinates(lat: Optional[float], lon: Optional[float]) -> Dict[str, Any]:
    """
    Validates whether given latitude and longitude coordinates fall strictly inside
    the approved Mumbai Operational Territory.
    
    Returns validation status:
    - VALID_MUMBAI: Strictly within Mumbai boundary polygon.
    - OUTSIDE_BOUNDARY: Georeferenced coordinate located outside Mumbai.
    - UNLOCATED_REVIEW: Missing or uncertain coordinates awaiting operator georeferencing.
    """
    if lat is None or lon is None:
        return {
            "is_valid": False,
            "boundary_status": "UNLOCATED_REVIEW",
            "reason": "Missing coordinate metadata. Retained in operator review queue.",
            "latitude": None,
            "longitude": None
        }

    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        return {
            "is_valid": False,
            "boundary_status": "UNLOCATED_REVIEW",
            "reason": f"Malformed coordinate values (lat={lat}, lon={lon}). Retained in review queue.",
            "latitude": None,
            "longitude": None
        }

    point = Point(lon_f, lat_f)
    is_inside = MUMBAI_POLYGON.contains(point) or MUMBAI_POLYGON.touches(point)

    if is_inside:
        return {
            "is_valid": True,
            "boundary_status": "VALID_MUMBAI",
            "reason": "Within approved Mumbai Municipal Operational Boundary",
            "latitude": lat_f,
            "longitude": lon_f
        }
    else:
        return {
            "is_valid": False,
            "boundary_status": "OUTSIDE_BOUNDARY",
            "reason": f"Coordinates ({lat_f:.4f}, {lon_f:.4f}) lie outside the approved Mumbai Operational Boundary. Rejected from active Mumbai dashboard.",
            "latitude": lat_f,
            "longitude": lon_f
        }

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates great-circle distance between two GPS coordinates in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def get_mumbai_boundary_geojson() -> Dict[str, Any]:
    """
    Returns GeoJSON Polygon of the approved Mumbai Operational Boundary for frontend mapping.
    """
    # GeoJSON expects coordinates as [longitude, latitude]
    coords = [[lon, lat] for lat, lon in MUMBAI_OPERATIONAL_BOUNDARY_COORDS]
    return {
        "type": "Feature",
        "properties": {
            "name": "Mumbai Municipal & Coastal Operational Boundary",
            "description": "Restricted operational area for JalRakshak sensor networks, drone surveys, and satellite detections.",
            "jurisdiction": "Brihanmumbai Municipal Corporation (BMC)"
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [coords]
        }
    }
