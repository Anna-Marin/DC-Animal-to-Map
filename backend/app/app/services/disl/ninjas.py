from typing import Any
from app.core.config import settings
from app.models.raw_data import DataSource
from .base import ETLProvider

class NinjasProvider(ETLProvider):
    def __init__(self):
        super().__init__(DataSource.NINJAS)
        self.api_key = settings.NINJAS_API_KEY
        self.base_url = settings.NINJAS_API_URL

    async def fetch(self) -> Any:
        if not self.api_key:
            raise ValueError("NINJAS_API_KEY is not set")
        
        async with self.get_client() as client:
            # Example query - fetching cheetahs as a default test
            response = await client.get(
                self.base_url,
                headers={"X-Api-Key": self.api_key},
                params={"name": "cheetah"} 
            )
            response.raise_for_status()
            return response.json()

    def normalize(self, raw_data: Any) -> Any:
        # Normalize data structure here
        return raw_data
