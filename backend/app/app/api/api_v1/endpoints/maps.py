import logging
from typing import Any
from fastapi import APIRouter, Depends, Query
from app.api import deps
import app.models as models

logger = logging.getLogger(__name__)

router = APIRouter()


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
        ninjas_raw = await ninjas_provider.fetch(animal_name)
        ninjas_normalized = ninjas_provider.normalize(ninjas_raw)
        # Aggregate all unique locations from all results
        all_locations = set()
        if ninjas_normalized:
            for item in ninjas_normalized:
                locs = item.get("locations")
                if locs:
                    all_locations.update(locs)
        locations = list(all_locations)
        if not locations:
            return {"error": "No location found for this animal."}
        # Use your ETL maps provider to get map data (coordinates)
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
    from app.models.raw_data import RawData, DataSource
    from app.db.session import get_engine
    from datetime import datetime, timedelta
    
    try:
        engine = get_engine()
        # Fetch latest eBird results from DB (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        results = await engine.find(
            RawData,
            RawData.source == DataSource.EBIRD,
            RawData.fetched_at >= thirty_days_ago,
            sort=RawData.fetched_at.desc(),
            limit=50
        )
        
        # Find observations matching the species - ONLY from normalized data
        observations = []
        species_lower = species.lower()
        logger.info(f"[EBIRD-OBS-MAP] Searching for species: '{species}' (normalized: '{species_lower}')")
        logger.info(f"[EBIRD-OBS-MAP] Found {len(results)} RawData records from last 30 days")
        for r in results:
            # Skip raw data, only process normalized data
            if r.metadata and r.metadata.get('type') != 'normalized':
                continue
            
            if isinstance(r.data, list):
                logger.info(f"[EBIRD-OBS-MAP] Processing normalized RawData with {len(r.data)} items")
                for idx, item in enumerate(r.data):
                    if isinstance(item, dict):
                        # Check normalized data structure - match by species name or sci_name
                        item_species = (item.get('species') or '').lower()
                        item_sci_name = (item.get('sci_name') or '').lower()
                        if idx < 3:
                            logger.info(f"[EBIRD-OBS-MAP] Item {idx}: species='{item.get('species')}', sci_name='{item.get('sci_name')}'")
                        # Match if search term is in species name OR scientific name
                        if species_lower in item_species or species_lower in item_sci_name:
                            observations.append({
                                "species": item.get("species"),
                                "sci_name": item.get("sci_name"),
                                "lat": item.get("lat"),
                                "lon": item.get("lon"),
                                "date": item.get("date"),
                                "location": item.get("location"),
                                "how_many": item.get("how_many"),
                                "obs_id": item.get("obs_id")
                            })
        
        # Remove duplicates by obs_id
        seen = set()
        unique_obs = []
        for obs in observations:
            obs_id = obs.get("obs_id")
            if obs_id and obs_id not in seen:
                seen.add(obs_id)
                unique_obs.append(obs)
        
        logger.info(f"[EBIRD-OBS-MAP] Found {len(observations)} total observations, {len(unique_obs)} unique after deduplication")
        
        if not unique_obs:
            logger.warning(f"[EBIRD-OBS-MAP] No observations found in DB for species '{species}', triggering ETL")
            # Trigger ETL to fetch fresh data from eBird directly (not via Celery)
            from app.services.disl.ebird import EBirdProvider
            try:
                # Run ETL directly
                provider = EBirdProvider()
                etl_result = await provider.run_etl(region_code="world", species=species, max_results=100)
                logger.info(f"[EBIRD-OBS-MAP] ETL completed, fetched {len(etl_result) if etl_result else 0} observations")
                
                # Now search again in the newly stored data
                results = await engine.find(
                    RawData,
                    RawData.source == DataSource.EBIRD,
                    RawData.fetched_at >= thirty_days_ago,
                    sort=RawData.fetched_at.desc(),
                    limit=50
                )
                
                observations = []
                for r in results:
                    if r.metadata and r.metadata.get('type') != 'normalized':
                        continue
                    if isinstance(r.data, list):
                        for item in r.data:
                            if isinstance(item, dict):
                                item_species = (item.get('species') or '').lower()
                                item_sci_name = (item.get('sci_name') or '').lower()
                                if species_lower in item_species or species_lower in item_sci_name:
                                    observations.append({
                                        "species": item.get("species"),
                                        "sci_name": item.get("sci_name"),
                                        "lat": item.get("lat"),
                                        "lon": item.get("lon"),
                                        "date": item.get("date"),
                                        "location": item.get("location"),
                                        "how_many": item.get("how_many"),
                                        "obs_id": item.get("obs_id")
                                    })
                
                # Deduplicate again
                seen = set()
                unique_obs = []
                for obs in observations:
                    obs_id = obs.get("obs_id")
                    if obs_id and obs_id not in seen:
                        seen.add(obs_id)
                        unique_obs.append(obs)
                
                logger.info(f"[EBIRD-OBS-MAP] After ETL: Found {len(unique_obs)} observations for species '{species}'")
                
                if not unique_obs:
                    return {"error": "No eBird observations found for this species even after fetching.", "observations": []}
                    
            except Exception as etl_error:
                logger.error(f"[EBIRD-OBS-MAP] ETL failed: {str(etl_error)}")
                return {"error": f"No cached data and ETL failed: {str(etl_error)}", "observations": []}
        
        logger.info(f"[EBIRD-OBS-MAP] Returning {len(unique_obs)} observations for species '{species}'")
        return {"observations": unique_obs, "count": len(unique_obs), "species": species}
    except Exception as e:
        logger.error(f"eBird observations map error: {str(e)}")
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}
