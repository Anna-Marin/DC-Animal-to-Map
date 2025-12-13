from typing import Any
from app.core.config import settings
from app.models.raw_data import DataSource
from .base import ETLProvider
import logging

logger = logging.getLogger(__name__)


class NinjasProvider(ETLProvider):
    def __init__(self):
        super().__init__(DataSource.NINJAS)
        self.api_key = settings.NINJAS_API_KEY
        self.base_url = settings.NINJAS_API_URL

    async def fetch(self, name: str = "cheetah") -> Any:
        if not self.api_key:
            raise ValueError("NINJAS_API_KEY is not set")
        # Try full name first, then each word
        names_to_try = [name] if name else []
        if name and " " in name:
            names_to_try += name.split()
        async with self.get_client() as client:
            for n in names_to_try:
                response = await client.get(
                    self.base_url,
                    headers={"X-Api-Key": self.api_key},
                    params={"name": n}
                )
                response.raise_for_status()
                logger.info(f"Ninjas API response for '{n}': {response.text}")
                data = response.json()
                if isinstance(data, list) and data:
                    return data
            # If nothing found, return last response (likely empty list)
            return data

    def normalize(self, raw_data: Any) -> Any:
        """
        Normalize Ninjas API data.
        """
        if not isinstance(raw_data, list):
            raw_data = [raw_data]
            
        normalized = []
        for item in raw_data:
            normalized.append({
                "name": item.get("name"),
                "taxonomy": item.get("taxonomy"),
                "locations": item.get("locations"),
                "characteristics": item.get("characteristics")
            })
        return normalized
