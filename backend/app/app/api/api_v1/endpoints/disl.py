from typing import Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.raw_data import RawData, DataSource
from app.db.session import get_engine
from app.worker.disl_tasks import run_wildlife_etl, run_ninjas_etl, run_maps_etl

router = APIRouter()

@router.post("/{provider}/run")
async def run_etl(provider: DataSource, background_tasks: BackgroundTasks):
    """
    Manually trigger an ETL process for a specific provider.
    """
    if provider == DataSource.WILDLIFE:
        task = run_wildlife_etl
    elif provider == DataSource.NINJAS:
        task = run_ninjas_etl
    elif provider == DataSource.MAPS:
        task = run_maps_etl
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")

    # Trigger Celery task
    task.delay()
    return {"message": f"ETL for {provider} started in background"}

@router.get("/{provider}/results", response_model=List[RawData])
async def get_etl_results(provider: DataSource, limit: int = 10):
    """
    Get the latest results for a specific provider.
    """
    engine = get_engine()
    results = await engine.find(
        RawData, 
        RawData.source == provider, 
        sort=RawData.fetched_at.desc(),
        limit=limit
    )
    return results

@router.get("/{provider}/history", response_model=List[dict])
async def get_etl_history(provider: DataSource, limit: int = 10):
    """
    Get the execution history (status and metadata) for a specific provider.
    """
    engine = get_engine()
    results = await engine.find(
        RawData, 
        RawData.source == provider, 
        sort=RawData.fetched_at.desc(),
        limit=limit
    )
    # Return simplified history
    return [
        {
            "fetched_at": r.fetched_at,
            "status": r.status,
            "error_message": r.error_message,
            "metadata": r.metadata
        }
        for r in results
    ]
