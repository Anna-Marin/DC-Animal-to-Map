from typing import Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from app.models.raw_data import RawData, DataSource
from app.models.user import User
from app.db.session import get_engine
from app.worker.disl_tasks import run_wildlife_etl, run_ninjas_etl, run_maps_etl
from app.api import deps

class RunETLRequest(BaseModel):
    region_code: str = "world"
    species: str = ""
    max_results: int = 100

router = APIRouter()

@router.post("/{provider}/run")
async def run_etl(
    provider: DataSource, 
    request: RunETLRequest, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_superuser)
):
    """
    Manually trigger an ETL process for a specific provider.
    Admin only endpoint.
    """

    if provider == DataSource.WILDLIFE:
        task = run_wildlife_etl
        task.delay()
    elif provider == DataSource.NINJAS:
        task = run_ninjas_etl
        task.delay()
    elif provider == DataSource.MAPS:
        task = run_maps_etl
        task.delay()
    elif provider == DataSource.EBIRD:
        from app.worker.disl_tasks import run_ebird_etl
        task = run_ebird_etl
        task.delay(request.region_code, request.species, request.max_results)
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")

    return {"message": f"ETL for {provider} started in background"}

@router.get("/{provider}/results", response_model=List[RawData])
async def get_etl_results(
    provider: DataSource, 
    species: str = "", 
    limit: int = 10,
    current_user: User = Depends(deps.get_current_active_superuser)
):
    """
    Get the latest results for a specific provider, optionally filtered by species.
    Admin only endpoint.
    """
    engine = get_engine()
    results = await engine.find(
        RawData, 
        RawData.source == provider, 
        sort=RawData.fetched_at.desc(),
        limit=limit
    )
    if species:
        # Filter results to only include data where species matches
        filtered_results = []
        for r in results:
            if isinstance(r.data, list):
                filtered_data = [item for item in r.data if isinstance(item, dict) and item.get('species', '').lower() == species.lower()]
                if filtered_data:
                    # Create a new RawData with filtered data
                    filtered_r = RawData(
                        source=r.source,
                        data=filtered_data,
                        fetched_at=r.fetched_at,
                        status=r.status,
                        error_message=r.error_message,
                        metadata=r.metadata
                    )
                    filtered_results.append(filtered_r)
            elif isinstance(r.data, dict) and r.data.get('species', '').lower() == species.lower():
                filtered_results.append(r)
        results = filtered_results[:limit]
    return results

@router.get("/{provider}/history", response_model=List[dict])
async def get_etl_history(
    provider: DataSource, 
    limit: int = 10,
    current_user: User = Depends(deps.get_current_active_superuser)
):
    """
    Get the execution history (status and metadata) for a specific provider.
    Admin only endpoint.
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
