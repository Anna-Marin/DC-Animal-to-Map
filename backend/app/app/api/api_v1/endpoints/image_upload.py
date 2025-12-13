
import logging
from typing import Any
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
    """
    Identify an animal from an uploaded image using the Wildlife API.
    """
    import os
    contents = await file.read()
    logger.info(f"Received image upload: {file.filename}, size={len(contents)} bytes")
    # Save the uploaded image to the project root for debugging
    debug_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), file.filename)
    with open(debug_path, "wb") as f:
        f.write(contents)
    # If image is larger than 5MB, resize/compress it using utility
    if len(contents) > 5 * 1024 * 1024:
        try:
            from app.services.disl.image_utils import resize_and_compress_image
            contents, _ = resize_and_compress_image(contents)
        except Exception as e:
            logger.error(f"Image resize/compression failed: {str(e)}")
            return {"error": f"Image resize/compression failed: {str(e)}"}

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

            return {
                "wildlife": important,
                "ninjas": ninjas_info
            }
        else:
            return {"name": None}
    except Exception as e:
        # Try to extract error details from the API response if available
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
