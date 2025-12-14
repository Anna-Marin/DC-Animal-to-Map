from typing import Any
from app.core.config import settings
from app.models.raw_data import DataSource
from .base import ETLProvider
import logging
logger = logging.getLogger(__name__)

class WildlifeProvider(ETLProvider):
    def __init__(self):
        super().__init__(DataSource.WILDLIFE)
        self.api_key = settings.WILDLIFE_API_KEY
        self.base_url = settings.WILDLIFE_API_URL

    async def fetch(self, image_bytes: bytes, filename: str, content_type: str = "image/jpeg", country: str = None, threshold: float = None) -> Any:
        if not self.api_key:
            raise ValueError("WILDLIFE_API_KEY is not set")

        # Preprocessing: Resize/compress if image is larger than 5MB
        if len(image_bytes) > 5 * 1024 * 1024:
            try:
                from .image_utils import resize_and_compress_image
                self.log_info(f"Image size {len(image_bytes)} bytes, resizing...")
                image_bytes, _ = resize_and_compress_image(image_bytes)
                self.log_info(f"Image resized to {len(image_bytes)} bytes")
            except Exception as e:
                self.log_error(f"Image resize/compression failed: {str(e)}")
                raise ValueError(f"Image preprocessing failed: {str(e)}")
        
        files = {"image": (filename, image_bytes, content_type)}
        data = {}
        if country:
            data["country"] = country
        if threshold is not None:
            data["threshold"] = str(threshold)

        async with self.get_client() as client:
            response = await client.post(
                f"{self.base_url}/v1/detect",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files=files,
                data=data,
                timeout=30.0
            )
            response.raise_for_status()
            logger.info(f"Wildlife API response: {response.text}")
            return response.json()

    def normalize(self, raw_data: Any) -> Any:

        if isinstance(raw_data, dict):
            annotations = raw_data.get("annotations", [])
        else:
            annotations = []

        normalized = []
        for item in annotations:
            normalized.append({
                "id": item.get("id"),
                "label": item.get("label"),
                "confidence": item.get("score"),
                "taxonomy": item.get("taxonomy", {}),
                "bbox": item.get("bbox"),
            })
        return normalized
