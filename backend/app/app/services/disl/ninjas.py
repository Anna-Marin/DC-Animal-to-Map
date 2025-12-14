from typing import Any
from app.core.config import settings
from app.models.raw_data import DataSource, ETLStatus
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
        
        async with self.get_client() as client:
            # Try full name first
            response = await client.get(
                self.base_url,
                headers={"X-Api-Key": self.api_key},
                params={"name": name}
            )
            response.raise_for_status()
            logger.info(f"Ninjas API response for '{name}': {response.text}")
            data = response.json()
            
            # If found results with full name, return them
            if isinstance(data, list) and data:
                return data
            
            if name and " " in name:
                words = name.split()
                last_word = words[-1]
                logger.info(f"No results for '{name}', trying last word: '{last_word}'")
                
                response = await client.get(
                    self.base_url,
                    headers={"X-Api-Key": self.api_key},
                    params={"name": last_word}
                )
                response.raise_for_status()
                logger.info(f"Ninjas API response for '{last_word}': {response.text}")
                data = response.json()
                
                # Filter results to match original name better
                if isinstance(data, list) and data:
                    # Prefer results that contain any word from original name
                    name_lower = name.lower()
                    filtered = [
                        item for item in data 
                        if name_lower in item.get("name", "").lower()
                    ]
                    return filtered if filtered else data
            
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

    async def save(self, raw_data: Any, normalized_data: Any):
        """
        Save raw and normalized data to the database.
        """
        await self.store(raw_data, status=ETLStatus.SUCCESS, metadata={"type": "raw"})
        await self.store(normalized_data, status=ETLStatus.SUCCESS, metadata={"type": "normalized"})

    async def get_locations(self, name: str) -> list[str]:
        """
        Fetch, normalize, and extract unique locations for an animal.
        """
        raw = await self.fetch(name)
        normalized = self.normalize(raw)
        
        all_locations = set()
        if normalized:
            for item in normalized:
                locs = item.get("locations")
                if locs:
                    all_locations.update(locs)
        
        await self.save(raw, normalized)
        
        return list(all_locations)
