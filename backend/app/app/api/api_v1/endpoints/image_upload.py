
import logging
from typing import Any
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from app.api import deps
import app.models as models
from app.services.disl.wildlife import WildlifeProvider

logger = logging.getLogger(__name__)

router = APIRouter()

from fastapi import Query


@router.post("/image-to-animal-info")
async def image_to_animal_info(
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    import os
    contents = await file.read()
    logger.info(f"Received image upload: {file.filename}, size={len(contents)} bytes")
    
    # Save the uploaded image to the project root for debugging
    debug_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), file.filename)
    with open(debug_path, "wb") as f:
        f.write(contents)

    provider = WildlifeProvider()
    if not provider.api_key:
        logger.error("Wildlife API key not set")
        return {"error": "Wildlife API key not set"}
    try:
        logger.debug(f"Using Wildlife API key: {provider.api_key}")
        data = await provider.fetch(contents, file.filename, file.content_type)
        normalized = provider.normalize(data)
        logger.info(f"Wildlife API normalized result: {normalized}")
        if normalized:
            # Find the annotation with the highest score
            best = max(normalized, key=lambda x: x.get("confidence", 0))
            important = {
                "name": best.get("species") or best.get("label"),
                "score": best.get("confidence"),
                "class": best.get("taxonomy", {}).get("class"),
                "order": best.get("taxonomy", {}).get("order"),
                "family": best.get("taxonomy", {}).get("family"),
                "genus": best.get("taxonomy", {}).get("genus"),
                "species": best.get("taxonomy", {}).get("species"),
            }

            # Fetch additional info from Ninjas API

            from app.services.disl.ninjas import NinjasProvider
            ninjas_provider = NinjasProvider()
            ninjas_info = None
            if ninjas_provider.api_key:
                try:
                    ninjas_raw = await ninjas_provider.fetch(important["name"])
                    ninjas_normalized = ninjas_provider.normalize(ninjas_raw)
                    ninjas_info = ninjas_normalized[0] if ninjas_normalized else None
                except Exception as e:
                    logger.error(f"Ninjas API fetch failed: {str(e)}")
                    ninjas_info = {"error": f"Ninjas API fetch failed: {str(e)}"}
            else:
                logger.warning("Ninjas API key not set")
                ninjas_info = {"error": "Ninjas API key not set"}

        
            # Save observation to DB
            try:
                from app.models import Observation
                from app.db.session import MongoDatabase
                from bson import ObjectId
                
                db = MongoDatabase()
                observations_collection = db["observations"]
                
                lat = current_user.latitude
                lon = current_user.longitude
                
                if (lat is None or lon is None) and hasattr(current_user, 'location') and current_user.location:
                    try:
                        from app.services.disl.maps import OpenStreetMapsProvider
                        provider = OpenStreetMapsProvider()
                        coords = await provider.geocode_single(current_user.location)
                        if coords:
                            lat = coords[0]
                            lon = coords[1]
                    except Exception as e:
                        logger.warning(f"Fallback geocoding failed: {e}")

                # Reverse geocode to get country code
                country_code = None
                if lat is not None and lon is not None:
                    try:
                        from app.services.disl.maps import OpenStreetMapsProvider
                        maps_provider = OpenStreetMapsProvider()
                        country_code = await maps_provider.reverse_geocode_country(lat, lon)
                        logger.info(f"Reverse geocoded country: {country_code}")
                    except Exception as e:
                        logger.warning(f"Reverse geocoding failed: {e}")

                observation_data = {
                    "user_id": current_user.id,
                    "user_name": current_user.full_name,
                    "species": important["name"],
                    "confidence": important["score"],
                    "image": contents,  # Already resized/compressed
                    "image_mime_type": file.content_type or "image/jpeg",
                    "latitude": lat,
                    "longitude": lon,
                    "country_code": country_code,
                    "timestamp": datetime.utcnow()
                }
                result = await observations_collection.insert_one(observation_data)
                observation_id = str(result.inserted_id)
                logger.info(f"Saved observation for user {current_user.id} and species {important['name']}")
                
                # Add observation ID to response
                response_data = {
                    "wildlife": important,
                    "ninjas": ninjas_info,
                    "observation_id": observation_id
                }
                return response_data

            except Exception as e:
                logger.error(f"Failed to save observation: {str(e)}")
                return {
                    "wildlife": important,
                    "ninjas": ninjas_info,
                    "error_saving_observation": str(e)
                }

        else:
            return {"name": None}
    except Exception as e:
        import traceback
        error_message = str(e)
        logger.error(f"Wildlife API error: {error_message}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_json = e.response.json()
                error_message = error_json.get('detail') or error_json or error_message
            except Exception:
                error_message = e.response.text or error_message
        logger.error(traceback.format_exc())
        return {"error": error_message, "trace": traceback.format_exc()}
