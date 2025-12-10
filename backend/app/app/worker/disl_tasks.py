import asyncio
from app.core.celery_app import celery_app
from app.services.disl import WildlifeProvider, NinjasProvider, GoogleMapsProvider
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

async def _run_etl(provider_cls):
    provider = provider_cls()
    return await provider.run()

@celery_app.task
def run_wildlife_etl():
    logger.info("Starting Wildlife ETL task")
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_run_etl(WildlifeProvider))

@celery_app.task
def run_ninjas_etl():
    logger.info("Starting Ninjas ETL task")
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_run_etl(NinjasProvider))

@celery_app.task
def run_maps_etl():
    logger.info("Starting Maps ETL task")
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_run_etl(GoogleMapsProvider))
