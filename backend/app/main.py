from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import DatabaseError, ping_database
from app.rv.routes import router as resource_vision_router

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
        ping_database()
    except DatabaseError as error:
        logging.getLogger("resource_vision").error("Database status check failed: %s", error)
        raise HTTPException(status_code=503, detail="The database is currently unavailable.") from error

    return {"connected": True}


app.include_router(resource_vision_router)
