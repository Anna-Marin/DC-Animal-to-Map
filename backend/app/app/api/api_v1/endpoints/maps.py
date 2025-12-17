import logging
from typing import Any
from fastapi import APIRouter, Depends, Query
from app.api import deps
import app.models as models

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/geocode")
async def geocode_location(
    address: str = Query(..., description="Address or location to geocode")
) -> Any:

    from app.services.disl.maps import OpenStreetMapsProvider
    
    try:
        maps_provider = OpenStreetMapsProvider()
        result = await maps_provider.geocode_single(address)
        
        if not result:
            return {"error": "Location not found"}
            
        return {
            "latitude": result["lat"],
            "longitude": result["lon"],
            "display_name": result.get("display_name", address)
        }
    except Exception as e:
        logger.error(f"Geocode error: {str(e)}")
        return {"error": str(e)}


@router.get("/animal-to-map")
async def animal_to_map(
    name: str = Query(None, description="Animal name"),
    current_user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get a map of the animal's location using Ninjas and ETL maps.
    """
    from app.services.disl.ninjas import NinjasProvider
    from app.services.disl.maps import OpenStreetMapsProvider
    import traceback
    try:
        ninjas_provider = NinjasProvider()
        animal_name = name or "zebra"
        
        # Use provider method
        locations = await ninjas_provider.get_locations(animal_name)
        
        if not locations:
            return {"error": "No location found for this animal."}
            
        maps_provider = OpenStreetMapsProvider()
        map_data = await maps_provider.get_map_for_locations(locations)
        
        if not map_data:
            return {"error": "Could not generate map for the given locations."}
            
        return {"map_data": map_data, "animal_name": animal_name, "locations": locations}
    except Exception as e:
        logger.error(f"Map endpoint error: {str(e)}")
        return {"error": str(e), "trace": traceback.format_exc()}


@router.get("/ebird-observations-map")
async def ebird_observations_map(
    species: str = Query(..., description="Species name (common or scientific)"),
    current_user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get eBird observations for a species to display on a map.
    """
    from app.services.disl.ebird import EBirdProvider
    
    try:
        provider = EBirdProvider()
        observations = await provider.get_observations(species)
        
        if not observations:
             return {"error": "No eBird observations found for this species.", "observations": []}
             
        return {"observations": observations, "count": len(observations), "species": species}
    except Exception as e:
        logger.error(f"eBird observations map error: {str(e)}")
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}
