from typing import Any
from app.core.config import settings
from app.models.raw_data import DataSource
from .base import ETLProvider

class GoogleMapsProvider(ETLProvider):
    def __init__(self):
        super().__init__(DataSource.MAPS)
        self.api_key = settings.GOOGLE_MAPS_API_KEY
        self.base_url = settings.GOOGLE_MAPS_API_URL

    async def fetch(self) -> Any:
        if not self.api_key:
            raise ValueError("GOOGLE_MAPS_API_KEY is not set")
        
        async with self.get_client() as client:
            # Example: Geocoding API
            response = await client.get(
                f"{self.base_url}/geocode/json",
                params={"address": "1600 Amphitheatre Parkway, Mountain View, CA", "key": self.api_key}
            )
            response.raise_for_status()
            return response.json()

    def normalize(self, raw_data: Any) -> Any:
        # Normalize data structure here
        return raw_data
