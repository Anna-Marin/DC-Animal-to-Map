
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.api_v1.api import api_router
from app.core.config import settings
from app.core.scheduler import setup_scheduler

# Global logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def app_init(app: FastAPI):
    # Initialize API router
    app.include_router(api_router, prefix=settings.API_V1_STR)
    
    # Initialize and start APScheduler for background tasks
    logger.info("Starting APScheduler for background ETL tasks")
    scheduler = setup_scheduler()
    scheduler.start()
    logger.info("APScheduler started successfully")
    
    yield
    
    # Shutdown scheduler on app exit
    logger.info("Shutting down APScheduler")
    scheduler.shutdown()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=app_init,
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        # Trailing slash causes CORS failures from these supported domains
        allow_origins=[str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS], # noqa
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

