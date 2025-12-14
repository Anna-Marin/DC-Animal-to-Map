from typing import Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel
from app.models.raw_data import RawData, DataSource
from app.models.user import User
from app.db.session import get_engine
from app.services.disl import WildlifeProvider, NinjasProvider, OpenStreetMapsProvider
from app.services.disl.ebird import EBirdProvider
from app.api import deps
import logging

logger = logging.getLogger(__name__)

class RunETLRequest(BaseModel):
    region_code: str = "world"
    species: str = ""
    max_results: int = 100

router = APIRouter()

# Background task functions
async def _run_wildlife_etl():
    """Background task for Wildlife ETL"""
    logger.info("Starting Wildlife ETL task")
    provider = WildlifeProvider()
    await provider.run()

async def _run_ninjas_etl():
    """Background task for Ninjas ETL"""
    logger.info("Starting Ninjas ETL task")
    provider = NinjasProvider()
    await provider.run()

async def _run_maps_etl():
    """Background task for Maps ETL"""
    logger.info("Starting Maps ETL task")
    provider = OpenStreetMapsProvider()
    await provider.run()

async def _run_ebird_etl(region_code: str, species: str, max_results: int):
    """Background task for eBird ETL"""
    logger.info(f"Starting eBird ETL task for region: {region_code}, species: {species}")
    provider = EBirdProvider()
    await provider.run_etl(region_code, species, max_results)

@router.post("/{provider}/run")
async def run_etl(
    provider: DataSource,
    request: RunETLRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_superuser)
):
    """
    Manually trigger an ETL process for a specific provider.
    Admin only endpoint - required by project specification A3.
    """
    if provider == DataSource.WILDLIFE:
        background_tasks.add_task(_run_wildlife_etl)
    elif provider == DataSource.NINJAS:
        background_tasks.add_task(_run_ninjas_etl)
    elif provider == DataSource.MAPS:
        background_tasks.add_task(_run_maps_etl)
    elif provider == DataSource.EBIRD:
        background_tasks.add_task(_run_ebird_etl, request.region_code, request.species, request.max_results)
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")

    return {"message": f"ETL for {provider.value} started in background", "status": "running"}

@router.get("/{provider}/results", response_model=List[RawData])
async def get_etl_results(
    provider: DataSource,
    species: str = Query("", description="Filter by species"),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(deps.get_current_active_superuser)
):
    engine = get_engine()
    results = await engine.find(
        RawData,
        RawData.source == provider,
        sort=RawData.fetched_at.desc(),
        limit=limit
    )
    
    if species:
        # Filter results by species
        filtered_results = []
        for r in results:
            if isinstance(r.data, list):
                filtered_data = [
                    item for item in r.data 
                    if isinstance(item, dict) and species.lower() in str(item.get('species', '')).lower()
                ]
                if filtered_data:
                    filtered_results.append(r)
            elif isinstance(r.data, dict) and species.lower() in str(r.data.get('species', '')).lower():
                filtered_results.append(r)
        results = filtered_results[:limit]
    
    return results

@router.get("/{provider}/history", response_model=List[dict])
async def get_etl_history(
    provider: DataSource,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(deps.get_current_active_superuser)
):

    engine = get_engine()
    results = await engine.find(
        RawData,
        RawData.source == provider,
        sort=RawData.fetched_at.desc(),
        limit=limit
    )
    
    return [
        {
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
            "status": r.status.value if r.status else "unknown",
            "error_message": r.error_message,
            "metadata": r.metadata,
            "data_count": len(r.data) if isinstance(r.data, list) else 1
        }
        for r in results
    ]
