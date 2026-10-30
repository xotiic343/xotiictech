from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from web.auth import router as auth_router
from web.stripe_hook import router as stripe_router
from web.api import router as api_router

log = logging.getLogger("vendingx.web.server")

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://xotiictech.net")

STATIC_DIR = Path(__file__).parent / "static"


def create_app() -> FastAPI:
    app = FastAPI(title="Vending X", docs_url=None, redoc_url=None)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_URL, "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(stripe_router)
    app.include_router(api_router)

    if STATIC_DIR.exists():
        app.mount("/vendingx", StaticFiles(directory=str(STATIC_DIR), html=True), name="vendingx-static")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    log.info("FastAPI app created")
    return app
