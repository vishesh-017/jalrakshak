import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.seed_data import seed_database
from app.routers import (
    sites,
    observations,
    detections,
    forecasts,
    cleanup,
    recovery,
    analytics,
    simulation,
    iot,
    hotspots,
    drone,
    worker,
    satellite,
    monsoon
)

# Ensure directories exist before mount
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.SAMPLES_DIR, exist_ok=True)

# Ensure tables exist at module load
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seed if fresh
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Predictive Plastic Leakage Monitoring and Smart Cleanup System for Mumbai Nullahs & Creeks",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads and sample creek camera feeds
app.mount("/api/static/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/api/static/sample_feeds", StaticFiles(directory=settings.SAMPLES_DIR), name="sample_feeds")

# Mount API Routers
app.include_router(sites.router, prefix=settings.API_V1_STR)
app.include_router(observations.router, prefix=settings.API_V1_STR)
app.include_router(detections.router, prefix=settings.API_V1_STR)
app.include_router(forecasts.router, prefix=settings.API_V1_STR)
app.include_router(cleanup.router, prefix=settings.API_V1_STR)
app.include_router(recovery.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(simulation.router, prefix=settings.API_V1_STR)
app.include_router(iot.router, prefix=settings.API_V1_STR)
app.include_router(hotspots.router, prefix=settings.API_V1_STR)
app.include_router(drone.router, prefix=settings.API_V1_STR)
app.include_router(worker.router, prefix=settings.API_V1_STR)
app.include_router(satellite.router, prefix=settings.API_V1_STR)
app.include_router(monsoon.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "system": "JalRakshak — Mumbai Creek Plastic Monitoring & Cleanup System",
        "version": settings.VERSION,
        "status": "Operational",
        "docs_url": "/docs"
    }

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "jalrakshak-backend"
    }
