"""
EVAC Congestion System — FastAPI Application Entry Point
=========================================================
Production-ready FastAPI backend that wraps the existing ML pipeline.
Models are loaded once at startup via the lifespan handler.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import logger
from app.api.routes import router
from app.services.impact_service import impact_service
from app.services.spatial_service import spatial_service
from app.services.anomaly_service import anomaly_service
from app.services.deployment_service import deployment_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all ML models once at startup; cleanup on shutdown."""
    logger.info("=" * 60)
    logger.info(f"  Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info("=" * 60)

    # Load P1 — Impact Forecaster models
    try:
        impact_service.load_models()
    except Exception as e:
        logger.error(f"P1 model loading failed: {e}")

    # Load P2 — Spatial / Heatmap artefacts
    try:
        spatial_service.load_models()
    except Exception as e:
        logger.error(f"P2 artefact loading failed: {e}")

    # Load P4 — Anomaly Detector (train on baseline)
    try:
        anomaly_service.load_and_train()
    except Exception as e:
        logger.error(f"P4 anomaly training failed: {e}")

    # Load P3 — Deployment Service (needs P2 corridor data)
    try:
        corridor_lookup = spatial_service.get_corridor_risk_lookup()
        deployment_service.load(corridor_lookup)
    except Exception as e:
        logger.error(f"P3 deployment loading failed: {e}")

    logger.info("All services initialised — API is ready")
    logger.info(f"Swagger docs: http://{settings.HOST}:{settings.PORT}/docs")
    logger.info("=" * 60)

    yield  # App is running

    logger.info("Shutting down EVAC API")


# ── Create the FastAPI application ────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "REST API for the EVAC Congestion System — "
        "impact prediction, congestion heatmaps, anomaly detection, "
        "and deployment recommendations for Bengaluru traffic management."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routes ──────────────────────────────────────────────────────────

app.include_router(router)


# ── Root redirect ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Root"], include_in_schema=False)
def root():
    """Redirect to API docs."""
    return {
        "message": f"{settings.APP_NAME} v{settings.APP_VERSION}",
        "docs": "/docs",
        "health": "/api/health",
    }
