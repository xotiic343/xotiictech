import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.core.logging import configure_logging
from app.core.middleware import OriginCheckMiddleware, SecurityHeadersMiddleware
from app.core.ratelimit import limiter
from app.routers.admin import auth as admin_auth
from app.routers.admin import bots as admin_bots
from app.routers.admin import catalog as admin_catalog
from app.routers.admin import inbox as admin_inbox
from app.routers.admin import site as admin_site
from app.routers.public import auth, bots, content, site, store
from app.services.scheduler import shutdown_scheduler, start_scheduler

configure_logging()
log = logging.getLogger("xotiictech")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.enable_scheduler:
        start_scheduler(sync_on_startup=settings.sync_on_startup)
    yield
    shutdown_scheduler()


app = FastAPI(
    title="XotiicTech API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limited(request: Request, exc: RateLimitExceeded):
    return JSONResponse({"detail": "Too many requests — slow down and try again shortly."}, status_code=429)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Trim pydantic's verbose error objects (they can echo input back).
    errors = [
        {"field": ".".join(str(p) for p in e.get("loc", [])[1:]), "message": e.get("msg", "Invalid value")}
        for e in exc.errors()
    ]
    return JSONResponse({"detail": "Validation failed", "errors": errors}, status_code=422)


app.add_middleware(OriginCheckMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["content-type", "x-csrf-token"],
)

for r in (site.router, bots.router, store.router, content.router, auth.router):
    app.include_router(r, prefix="/api")

for r in (
    admin_auth.router,
    admin_bots.router,
    admin_catalog.products,
    admin_catalog.blog,
    admin_catalog.docs,
    admin_catalog.testimonials,
    admin_catalog.uploads,
    admin_inbox.router,
    admin_site.router,
):
    app.include_router(r, prefix="/api")
