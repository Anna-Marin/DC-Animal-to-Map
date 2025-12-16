import urllib.parse
from typing import Any
from app.core.config import settings
from app.models.raw_data import DataSource
from .base import ETLProvider
import logging


class OpenStreetMapsProvider(ETLProvider):
    def __init__(self):
        super().__init__(DataSource.MAPS)
        self.base_url = settings.OPEN_STREET_MAPS_API_URL
        self.photon_url = settings.PHOTON_API_URL
        self.photon_reverse_url = settings.PHOTON_REVERSE_API_URL

    async def get_map_for_locations(self, locations):
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
                logger.info(f"[ETL-MAP] Querying Photon for: {loc}")
                photon_results = await self.fetch(loc)
                coords = []
                features = photon_results.get("features", [])
                for item in features:
                    geom = item.get("geometry", {})
                    props = item.get("properties", {})
                    
                    if geom.get("type") == "Point" and geom.get("coordinates"):
                        lon, lat = geom["coordinates"]
                        coords.append({"lat": float(lat), "lon": float(lon)})
                        
                if coords:
                    # Only take the first (most relevant) coordinate for each location
                    logger.info(f"[ETL-MAP] Found {len(coords)} coordinates for {loc}, using the first one")
                    location_results[loc] = [coords[0]]
                else:
                    logger.warning(f"[ETL-MAP] No coordinates found for location: {loc}")
                    location_results[loc] = []
            except Exception as e:
                error_msg = str(e)
                if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                    logger.error(f"[ETL-MAP] Timeout fetching coordinates from Photon for {loc} - location may be too broad or API is slow")
                else:
                    logger.error(f"[ETL-MAP] Error fetching coordinates from Photon for {loc}: {e}")
                location_results[loc] = []
        all_coords = [c for coords in location_results.values() for c in coords]
        center = all_coords[0] if all_coords else {"lat": 0, "lon": 0}
        logger.info(f"[ETL-MAP] Finished. Total coordinates: {len(all_coords)}")
        return {
            "coordinates": all_coords,
            "center": center,
            "location_results": location_results
        }

    async def fetch(self, query: str = "NONE") -> Any:
        params = {
            "q": query,
            "limit": 10
        }
        
        async with self.get_client() as client:
            response = await client.get(
                self.photon_url,
                params=params
            )
            response.raise_for_status()
            return response.json()

    def normalize(self, raw_data: Any) -> Any:
        features = raw_data.get("features", []) if isinstance(raw_data, dict) else []
            
        normalized = []
        for item in features:
            geom = item.get("geometry", {})
            props = item.get("properties", {})
            coords = geom.get("coordinates", [None, None]) # lon, lat
            
            normalized.append({
                "place_id": props.get("osm_id"),
                "name": props.get("name"),
                "lat": coords[1],
                "lon": coords[0],
                "type": props.get("osm_value"),
                "class": props.get("osm_key")
            })
        return normalized

    async def geocode_single(self, location: str) -> tuple[float, float] | None:
        try:
            data = await self.fetch(location)
            features = data.get("features", [])
            if features:
                coords = features[0]["geometry"]["coordinates"]
                return float(coords[1]), float(coords[0]) # Return (lat, lon)
        except Exception:
            return None
        return None

    async def reverse_geocode_country(self, lat: float, lon: float) -> str | None:
        logger = logging.getLogger("app.services.disl.maps")
        try:
            # Use Photon reverse geocoding
            async with self.get_client() as client:
                response = await client.get(
                    self.photon_reverse_url,
                    params={"lat": lat, "lon": lon, "limit": 1}
                )
                response.raise_for_status()
                data = response.json()
                
                features = data.get("features", [])
                if features:
                    props = features[0].get("properties", {})
                    # Photon returns country code in 'countrycode' field
                    country_code = props.get("countrycode")
                    if country_code:
                        logger.info(f"Reverse geocoded ({lat}, {lon}) to country: {country_code}")
                        return country_code.upper()
                    
                logger.warning(f"No country code found for coordinates ({lat}, {lon})")
                return None
        except Exception as e:
            logger.error(f"Reverse geocoding failed for ({lat}, {lon}): {e}")
            return None
