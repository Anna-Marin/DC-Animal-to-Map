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
                data=data
            )
            response.raise_for_status()
            logger.info(f"Wildlife API response: {response.text}")
            return response.json()

    def normalize(self, raw_data: Any) -> Any:
        """
        Normalize Wildlife API data.
        Extracts 'annotations' from the API response.
        """
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
