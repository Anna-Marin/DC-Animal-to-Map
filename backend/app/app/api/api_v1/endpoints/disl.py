from typing import Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel
from motor.core import AgnosticDatabase as MongoDatabase
from app.models.raw_data import RawData, DataSource, ETLStatus
from app.models.user import User
from app.services.disl import WildlifeProvider, NinjasProvider, OpenStreetMapsProvider
from app.services.disl.ebird import EBirdProvider
from app.api import deps
import logging

logger = logging.getLogger(__name__)

class RunETLRequest(BaseModel):
    region_code: str = "world"
    species: str = ""
    max_results: int = 100

class QueryRequest(BaseModel):
    region_code: str = "ES"
    species: str = ""
    max_results: int = 100
    image_url: str = ""
    animal_name: str = ""
    location: str = ""

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
    request: QueryRequest,
    current_user: User = Depends(deps.get_current_active_superuser)
):
    """
    Query a provider, save results to database, and return raw results.
    Admin only endpoint - for testing queries.
    """
    try:
        if provider == DataSource.EBIRD:
            ebird_provider = EBirdProvider()
            result = await ebird_provider.fetch(
                region_code=request.region_code,
                species_code=request.species if request.species else None,
                max_results=request.max_results
            )
            # Save to database
            normalized = ebird_provider.normalize(result)
            await ebird_provider.save(result, normalized)
            return {"provider": provider.value, "data": result, "count": len(result) if isinstance(result, list) else 1}
        
        elif provider == DataSource.WILDLIFE:
            if not request.image_url:
                raise HTTPException(status_code=400, detail="image_url is required for Wildlife queries")
            # Wildlife needs image bytes, not URL - return info message
            return {"provider": provider.value, "message": "Wildlife provider requires image upload, not URL. Use the image-to-animal page instead."}
        
        elif provider == DataSource.NINJAS:
            if not request.animal_name:
                raise HTTPException(status_code=400, detail="animal_name is required for Ninjas queries")
            ninjas_provider = NinjasProvider()
            result = await ninjas_provider.fetch(name=request.animal_name)
            # Save to database
            normalized = ninjas_provider.normalize(result)
            await ninjas_provider.save(result, normalized)
            return {"provider": provider.value, "data": result, "count": len(result) if isinstance(result, list) else 1}
        
        elif provider == DataSource.MAPS:
            if not request.location:
                raise HTTPException(status_code=400, detail="location is required for Maps queries")
            maps_provider = OpenStreetMapsProvider()
            result = await maps_provider.geocode_single(request.location)
            # Save to database
            await maps_provider.store({"location": request.location, "coordinates": result}, status=ETLStatus.SUCCESS, metadata={"query": request.location})
            return {"provider": provider.value, "data": result}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid provider")
    
    except Exception as e:
        logger.error(f"Error querying {provider.value}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@router.get("/{provider}/results", response_model=List[RawData])
async def get_etl_results(
    provider: DataSource,
    species: str = Query("", description="Filter by species"),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(deps.get_current_active_superuser)
):
    from app.db.session import MongoDatabase
    db = MongoDatabase()
    raw_data_collection = db["raw_data"]
    
    cursor = raw_data_collection.find(
        {"source": provider.value}
    ).sort("fetched_at", -1).limit(limit)
    
    results = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        
        if species:
            # Filter by species
            if isinstance(doc.get("data"), list):
                filtered_data = [
                    item for item in doc["data"] 
                    if isinstance(item, dict) and species.lower() in str(item.get('species', '')).lower()
                ]
                if filtered_data:
                    results.append(RawData(**doc))
            elif isinstance(doc.get("data"), dict) and species.lower() in str(doc["data"].get('species', '')).lower():
                results.append(RawData(**doc))
        else:
            results.append(RawData(**doc))
    
    return results[:limit]

@router.get("/{provider}/history", response_model=List[dict])
async def get_etl_history(
    provider: DataSource,
    limit: int = Query(20, ge=1, le=100),
    db: MongoDatabase = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_superuser)
):

    cursor = db["raw_data"].find(
        {"source": provider.value}
    ).sort("fetched_at", -1).limit(limit)
    
    results = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        results.append(RawData(**doc))
    
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
