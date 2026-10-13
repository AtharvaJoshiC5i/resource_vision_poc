from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import DatabaseError, ping_database
from app.repository.resource_vision_repository import load_resource_vision_bundle

app = FastAPI(
    title="Resource Vision Data API",
    description="Read-only Azure SQL bridge for Resource Vision POC.",
    version="1.0.0",
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/database/status")
def database_status() -> dict[str, object]:
    try:
        details = ping_database()
    except DatabaseError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {
        "connected": True,
        **details,
    }


@app.get("/api/data/resource-vision")
def resource_vision_bundle() -> dict[str, object]:
    try:
        return load_resource_vision_bundle()
    except DatabaseError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
