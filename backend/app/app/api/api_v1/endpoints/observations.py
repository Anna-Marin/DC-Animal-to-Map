from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from app.api import deps
from app.models.user import User
from app.models.observation import Observation
from app.services.disl.ebird import EBirdProvider
import logging
import base64

logger = logging.getLogger(__name__)

router = APIRouter()

# Simple country name to code mapping
COUNTRY_CODES = {
    "world": "world",
    "spain": "ES",
    "usa": "US",
    "united states": "US",
    "france": "FR",
    "germany": "DE",
    "italy": "IT",
    "uk": "GB",
    "united kingdom": "GB", 
    "brazil": "BR",
    "australia": "AU",
    "india": "IN",
    "china": "CN",
    "russia": "RU",
    "south africa": "ZA",
    "mexico": "MX",
    "argentina": "AR",
    "japan": "JP",
    "canada": "CA"
}

@router.get("/search")
async def search_observations(
    country: Optional[str] = Query("world", description="Country name or code"),
    species: Optional[str] = Query(None, description="Species name"),
    max_results: int = 100,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    country_lower = country.lower()
    region_code = COUNTRY_CODES.get(country_lower, country.upper())
    
    if len(country) == 2:
        region_code = country.upper()

    logger.info(f"Searching observations for {country} (code: {region_code}), species: {species}")

    results = {
        "ebird": [],
        "local": [],
        "region_code": region_code
    }

    try:
        provider = EBirdProvider()
        ebird_data = await provider.run_etl(
            region_code=region_code, 
            species=species if species else "", 
            max_results=max_results
        )
        results["ebird"] = ebird_data
    except Exception as e:
        logger.error(f"Error fetching from eBird: {str(e)}")
        results["ebird_error"] = str(e)

    try:
        from app.db.session import MongoDatabase
        db = MongoDatabase()
        observations_collection = db["observations"]
        
        # Build query
        query = {"latitude": {"$ne": None}}
        
        # Filter by country if not "world"
        if region_code != "world":
            query["country_code"] = region_code
        
        formatted_local = []
        async for obs_doc in observations_collection.find(query):
            if species and species.lower() not in obs_doc.get("species", "").lower():
                continue

            image_b64 = base64.b64encode(obs_doc["image"]).decode('utf-8')
            formatted_local.append({
                "id": str(obs_doc["_id"]),
                "species": obs_doc["species"],
                "confidence": obs_doc["confidence"],
                "user_name": obs_doc["user_name"],
                "timestamp": obs_doc["timestamp"],
                "lat": obs_doc["latitude"],
                "lon": obs_doc["longitude"],
                "image": f"data:{obs_doc['image_mime_type']};base64,{image_b64}"
            })
        results["local"] = formatted_local
        
    except Exception as e:
        logger.error(f"Error fetching local observations: {str(e)}")
        results["local_error"] = str(e)

    return results
