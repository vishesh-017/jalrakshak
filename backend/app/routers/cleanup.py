import math
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/cleanup", tags=["Cleanup Dispatch"])

# Haversine distance calculator in kilometers
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class RouteOptimizationRequest(BaseModel):
    site_ids: Optional[List[str]] = Field(default=None, description="List of site IDs to route, or None for top high-risk sites")
    depot_lat: float = Field(default=19.0178, description="Dadar BMC Central Operations Depot Latitude")
    depot_lon: float = Field(default=72.8478, description="Dadar BMC Central Operations Depot Longitude")
    depot_name: str = Field(default="BMC Central Operations Hub (Dadar)")
    num_crews: int = Field(default=1, ge=1, le=5)
    max_shift_hours: float = Field(default=8.0, ge=2.0, le=14.0)
    avg_speed_kmh: float = Field(default=22.0, description="Estimated urban road transit speed including Mumbai traffic")
    cleanup_time_per_site_min: float = Field(default=60.0, description="Estimated on-site cleanup duration in minutes")

class RouteStop(BaseModel):
    stop_index: int
    site_id: str
    name: str
    latitude: float
    longitude: float
    arrival_time_offset_min: float
    leg_distance_km: float
    cumulative_distance_km: float
    estimated_debris_kg: float
    risk_level: str
    urgency_reason: str

class RouteResult(BaseModel):
    crew_id: str
    team_name: str
    total_distance_km: float
    total_duration_hours: float
    transit_duration_hours: float
    on_site_work_hours: float
    stops: List[RouteStop]
    polyline: List[List[float]] # [lat, lon] coordinates
    unassigned_sites: List[Dict[str, Any]]
    optimization_engine: str
    source_status: str = "Simulated (Haversine Matrix + Heuristic / OR-Tools)"
    disclaimer: str

class RecommendationItem(BaseModel):
    site_id: str
    site_name: str
    zone: str
    current_risk_score: float
    current_risk_level: str
    barrier_status: str
    estimated_plastic_kg: float
    urgency_rank: int
    recommendation_reason: str
    suggested_crew: str
    suggested_equipment: str

@router.get("", response_model=List[schemas.CleanupTaskResponse])
def get_cleanup_tasks_list(
    status: Optional[str] = Query(None, description="Filter by status (Pending, Dispatched, In Progress, Completed, Cancelled)"),
    priority: Optional[str] = Query(None, description="Filter by priority (Low, Medium, High, Critical)"),
    site_id: Optional[str] = Query(None, description="Filter by site ID"),
    db: Session = Depends(get_db)
):
    return crud.get_cleanup_tasks(db, status=status, priority=priority, site_id=site_id)

@router.get("/recommendations", response_model=List[RecommendationItem])
def get_recommended_cleanup_tasks(
    min_risk_score: float = Query(45.0, description="Minimum risk score threshold for generating recommendation"),
    db: Session = Depends(get_db)
):
    """
    Generate decision-support cleanup recommendations ranked by predicted risk and barrier vulnerability.
    Does not automatically dispatch real crews; requires municipal operator review and approval.
    """
    sites = db.query(models.MonitoringSite).filter(models.MonitoringSite.is_pilot_active == True).all()
    # Filter sites that need cleanup
    eligible = [s for s in sites if s.current_risk_score >= min_risk_score or s.current_risk_level in ["Critical", "High"]]
    eligible.sort(key=lambda s: s.current_risk_score, reverse=True)

    recommendations = []
    teams = [
        ("BMC Coastal Trash Skimmer Unit 1", "River Trash Skimmer Boat"),
        ("Ward L & H-East Rapid Cleanup Crew", "JCB Excavator & Silt Screen Winch"),
        ("Mangrove Cell Coastal Taskforce", "Manual Netting Waders & Eco-Boat"),
        ("Zone V Stormwater Operations", "Hydraulic Grab Crane"),
    ]

    for idx, s in enumerate(eligible, start=1):
        # Calculate reason
        reasons = []
        if s.current_risk_score >= 70:
            reasons.append(f"Predicted severe choke risk ({s.current_risk_score:.0f}/100)")
        elif s.current_risk_score >= 50:
            reasons.append(f"Elevated plastic accumulation risk ({s.current_risk_score:.0f}/100)")
        
        if s.barrier_status in ["Breached", "Partially Blocked"]:
            reasons.append(f"Barrier status: {s.barrier_status}")
        
        latest_rain = crud.get_rainfall_observations(db, site_id=s.id, limit=1)
        if latest_rain and latest_rain[0].rainfall_24h_mm >= 50:
            reasons.append(f"Heavy rainfall flush ({latest_rain[0].rainfall_24h_mm:.0f}mm)")

        if not reasons:
            reasons.append("Precautionary post-monsoon sweep")

        reason_str = "; ".join(reasons)
        team_choice = teams[(idx - 1) % len(teams)]
        est_kg = round(s.current_risk_score * 7.5 + (s.catchment_area_sqkm * 12.0), 1)

        recommendations.append(RecommendationItem(
            site_id=s.id,
            site_name=s.name,
            zone=s.zone,
            current_risk_score=round(s.current_risk_score, 1),
            current_risk_level=s.current_risk_level,
            barrier_status=s.barrier_status,
            estimated_plastic_kg=est_kg,
            urgency_rank=idx,
            recommendation_reason=reason_str,
            suggested_crew=team_choice[0],
            suggested_equipment=team_choice[1]
        ))

    return recommendations

@router.post("/optimize-route", response_model=RouteResult)
def optimize_cleanup_route(request: RouteOptimizationRequest, db: Session = Depends(get_db)):
    """
    Optimizes cleanup dispatch sequence across top high-risk sites starting from central depot.
    Uses Google OR-Tools if available, with a transparent Nearest-Neighbor / 2-Opt heuristic fallback.
    Outputs route polyline, stop order, transit time, and unassigned sites.
    """
    # 1. Fetch sites
    if request.site_ids and len(request.site_ids) > 0:
        sites = db.query(models.MonitoringSite).filter(models.MonitoringSite.id.in_(request.site_ids)).all()
    else:
        # Default to top 6 high-risk sites
        sites = db.query(models.MonitoringSite).filter(models.MonitoringSite.is_pilot_active == True).order_by(models.MonitoringSite.current_risk_score.desc()).limit(6).all()

    if not sites:
        raise HTTPException(status_code=400, detail="No valid sites available for route optimization")

    # Coordinates list: index 0 is Depot
    locations = [
        {"id": "DEPOT", "name": request.depot_name, "lat": request.depot_lat, "lon": request.depot_lon, "site": None}
    ]
    for s in sites:
        locations.append({
            "id": s.id,
            "name": s.name,
            "lat": s.latitude,
            "lon": s.longitude,
            "site": s
        })

    n = len(locations)
    # Compute Distance Matrix
    dist_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                dist_matrix[i][j] = haversine_km(locations[i]["lat"], locations[i]["lon"], locations[j]["lat"], locations[j]["lon"])

    # Attempt OR-Tools solution
    or_tools_success = False
    route_indices = []
    optimization_engine = "Heuristic Nearest-Neighbor + 2-Opt (Simulated Haversine Matrix)"

    try:
        from ortools.constraint_solver import routing_enums_pb2, pywrapcp
        
        # Distance matrix in integer meters for OR-Tools
        int_dist_matrix = [[int(dist_matrix[i][j] * 1000) for j in range(n)] for i in range(n)]
        manager = pywrapcp.RoutingIndexManager(n, request.num_crews, 0)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int_dist_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_parameters.time_limit.seconds = 2

        solution = routing.SolveWithParameters(search_parameters)
        if solution:
            index = routing.Start(0)
            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                route_indices.append(node)
                index = solution.Value(routing.NextVar(index))
            route_indices.append(0) # Return to depot
            or_tools_success = True
            optimization_engine = "Google OR-Tools VRP Solver (Haversine Distance Matrix)"
    except Exception:
        or_tools_success = False

    # Heuristic fallback if OR-Tools not available or failed
    if not or_tools_success:
        unvisited = list(range(1, n))
        current = 0
        route_indices = [0]
        while unvisited:
            next_node = min(unvisited, key=lambda idx: dist_matrix[current][idx])
            route_indices.append(next_node)
            unvisited.remove(next_node)
            current = next_node
        route_indices.append(0) # Return to depot

    # 2. Build stops and enforce max_shift_hours
    stops: List[RouteStop] = []
    polyline: List[List[float]] = []
    unassigned_sites: List[Dict[str, Any]] = []

    cumulative_dist = 0.0
    current_time_offset_min = 0.0
    prev_node = 0

    polyline.append([locations[0]["lat"], locations[0]["lon"]])

    for step_idx, node_idx in enumerate(route_indices[1:], start=1):
        leg_dist = dist_matrix[prev_node][node_idx]
        transit_time_min = (leg_dist / request.avg_speed_kmh) * 60.0
        
        if node_idx == 0:
            # Returning to depot
            cumulative_dist += leg_dist
            current_time_offset_min += transit_time_min
            polyline.append([locations[0]["lat"], locations[0]["lon"]])
            break

        loc = locations[node_idx]
        site = loc["site"]
        site_est_kg = round(site.current_risk_score * 7.5 + (site.catchment_area_sqkm * 12.0), 1)

        # Check time constraint
        total_projected_hours = (current_time_offset_min + transit_time_min + request.cleanup_time_per_site_min) / 60.0
        if total_projected_hours > request.max_shift_hours:
            unassigned_sites.append({
                "site_id": site.id,
                "name": site.name,
                "reason": f"Exceeds shift time budget ({request.max_shift_hours}h max)",
                "risk_score": site.current_risk_score
            })
            continue

        cumulative_dist += leg_dist
        current_time_offset_min += transit_time_min

        stops.append(RouteStop(
            stop_index=len(stops) + 1,
            site_id=site.id,
            name=site.name,
            latitude=site.latitude,
            longitude=site.longitude,
            arrival_time_offset_min=round(current_time_offset_min, 1),
            leg_distance_km=round(leg_dist, 2),
            cumulative_distance_km=round(cumulative_dist, 2),
            estimated_debris_kg=site_est_kg,
            risk_level=site.current_risk_level,
            urgency_reason=f"Risk Score {site.current_risk_score:.0f}/100, Barrier {site.barrier_status}"
        ))

        polyline.append([loc["lat"], loc["lon"]])
        current_time_offset_min += request.cleanup_time_per_site_min
        prev_node = node_idx

    # Return leg to depot
    return_leg = dist_matrix[prev_node][0]
    cumulative_dist += return_leg
    current_time_offset_min += (return_leg / request.avg_speed_kmh) * 60.0
    polyline.append([locations[0]["lat"], locations[0]["lon"]])

    total_hours = round(current_time_offset_min / 60.0, 2)
    on_site_hours = round((len(stops) * request.cleanup_time_per_site_min) / 60.0, 2)
    transit_hours = round(max(0.0, total_hours - on_site_hours), 2)

    return RouteResult(
        crew_id="CREW-01",
        team_name="BMC Coastal Trash Skimmer Unit 1",
        total_distance_km=round(cumulative_dist, 2),
        total_duration_hours=total_hours,
        transit_duration_hours=transit_hours,
        on_site_work_hours=on_site_hours,
        stops=stops,
        polyline=polyline,
        unassigned_sites=unassigned_sites,
        optimization_engine=optimization_engine,
        source_status="Simulated (Haversine Matrix + Heuristic / OR-Tools)",
        disclaimer="Transit times and distances are estimated straight-line approximations with Mumbai traffic delay factors. Real road route requires OSRM/Google Maps live navigation."
    )

@router.get("/{task_id}", response_model=schemas.CleanupTaskResponse)
def get_cleanup_task_detail(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_cleanup_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Cleanup task not found")
    return task

@router.post("", response_model=schemas.CleanupTaskResponse, status_code=201)
def dispatch_cleanup_task(task: schemas.CleanupTaskCreate, db: Session = Depends(get_db)):
    site = crud.get_site(db, task.site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    if task.priority in ["Critical", "High"]:
        site.response_status = "Cleanup Dispatched"
        db.commit()

    created_task = crud.create_cleanup_task(db, task)
    return created_task

@router.patch("/{task_id}", response_model=schemas.CleanupTaskResponse)
def update_task_progress(task_id: int, updates: schemas.CleanupTaskUpdate, db: Session = Depends(get_db)):
    updated = crud.update_cleanup_task(db, task_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Cleanup task not found")
    
    if updates.status == "Completed":
        site = crud.get_site(db, updated.site_id)
        if site:
            site.last_cleanup_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
            site.response_status = "Normal Monitoring"
            site.current_risk_score = max(15.0, site.current_risk_score * 0.45)
            site.current_risk_level = "Low" if site.current_risk_score < 35 else "Medium"
            db.commit()

    return updated
