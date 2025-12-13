import urllib.parse
from typing import Any
from app.core.config import settings
from app.models.raw_data import DataSource
from .base import ETLProvider


class OpenStreetMapsProvider(ETLProvider):
    def __init__(self):
        super().__init__(DataSource.MAPS)
        self.api_key = settings.OPEN_STREET_MAPS_API_KEY
        self.base_url = settings.OPEN_STREET_MAPS_API_URL

    async def get_map_for_locations(self, locations):
        import logging
        logger = logging.getLogger("app.services.disl.maps")
        logger.info(f"[ETL-MAP] Starting get_map_for_locations for: {locations}")
        if not locations:
            logger.warning("[ETL-MAP] No locations provided.")
            return None
        if not isinstance(locations, list):
            locations = [locations]
        location_results = {}
        for loc in locations:
            try:
                logger.info(f"[ETL-MAP] Querying Nominatim for: {loc}")
                nominatim_results = await self.fetch(loc)
                coords = []
                for item in nominatim_results:
                    # Only accept type country or continent
                    if (
                        item.get("lat") and item.get("lon") and
                        (item.get("type") == "country" or item.get("type") == "continent")
                    ):
                        coords.append({"lat": float(item["lat"]), "lon": float(item["lon"])} )
                if coords:
                    logger.info(f"[ETL-MAP] Found {len(coords)} coordinates for {loc} (Nominatim, filtered)")
                    location_results[loc] = coords
                else:
                    logger.warning(f"[ETL-MAP] No coordinates found for location: {loc}")
                    location_results[loc] = []
            except Exception as e:
                logger.error(f"[ETL-MAP] Error fetching coordinates from Nominatim for {loc}: {e}")
                location_results[loc] = []
        all_coords = [c for coords in location_results.values() for c in coords]
        center = all_coords[0] if all_coords else {"lat": 0, "lon": 0}
        logger.info(f"[ETL-MAP] Finished. Total coordinates: {len(all_coords)}")
        return {
            "coordinates": all_coords[:50],
            "center": center,
            "location_results": location_results
        }

    async def fetch(self, query: str = "NONE") -> Any:
        """
        Fetch location data from OpenStreetMaps (Nominatim).
        """
        params = {
            "q": query,
            "format": "json",
            "limit": 10
        }
        # Some Nominatim instances require a User-Agent
        headers = {"User-Agent": "AnimalToMap/1.0"}
        
        async with self.get_client() as client:
            response = await client.get(
                f"{self.base_url}/search",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            return response.json()

    def normalize(self, raw_data: Any) -> Any:
        """
        Normalize OSM data to a simplified list of locations.
        """
        if not isinstance(raw_data, list):
            raw_data = [raw_data]
            
        normalized = []
        for item in raw_data:
            normalized.append({
                "place_id": item.get("place_id"),
                "name": item.get("display_name"),
                "lat": item.get("lat"),
                "lon": item.get("lon"),
                "type": item.get("type"),
                "class": item.get("class")
            })
        return normalized
