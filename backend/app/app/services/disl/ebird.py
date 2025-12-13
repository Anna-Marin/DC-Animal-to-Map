import asyncio
import logging
from typing import Any, List
from app.services.disl.base import ETLProvider
from app.models.raw_data import DataSource, ETLStatus
from app.core.config import settings
import httpx

class EBirdProvider(ETLProvider):
    def __init__(self):
        super().__init__(DataSource.EBIRD)
        self.api_key = settings.EBIRD_API_KEY
        self.base_url = "https://api.ebird.org/v2/data/obs/"
        self.taxonomy_url = "https://api.ebird.org/v2/ref/taxonomy/ebird"
        self.logger = logging.getLogger("app.services.disl.ebird")
        self.taxonomy_cache = None

    async def get_species_code(self, common_name: str) -> str:
        if not self.taxonomy_cache:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(self.taxonomy_url, params={"fmt": "json"})
                resp.raise_for_status()
                self.taxonomy_cache = resp.json()
        name_l = name.lower()
        # Exact match common name
        for species in self.taxonomy_cache:
            if species.get("comName", "").lower() == name_l:
                return species.get("speciesCode", "")
        # Exact match scientific name
        for species in self.taxonomy_cache:
            if species.get("sciName", "").lower() == name_l:
                return species.get("speciesCode", "")
        # Partial match common/scientific name
        for species in self.taxonomy_cache:
            if name_l in species.get("comName", "").lower() or name_l in species.get("sciName", "").lower():
                return species.get("speciesCode", "")
        raise ValueError(f"Species '{name}' not found in eBird taxonomy.")

    async def fetch(self, region_code: str = "world", species_code: str = "", max_results: int = 100) -> Any:
        print(f"[DEBUG][EBIRD-ETL] Fetching eBird data for region: {region_code}, species: {species_code}, max_results: {max_results}")
        headers = {"X-eBirdApiToken": self.api_key}
        params = {"maxResults": max_results}
        retries = 3
        if region_code.lower() == "world":
            # List of major countries for global coverage
            country_codes = [
                "US", "CA", "GB", "DE", "FR", "ES", "IT", "AU", "BR", "IN", "CN", "RU", "ZA", "MX", "AR", "JP"
            ]
            all_results = []
            seen_obs = set()
            for country in country_codes:
                url = f"{self.base_url}{country}/recent/{species_code}" if species_code else f"{self.base_url}{country}/recent"
                for attempt in range(retries):
                    print(f"[DEBUG][EBIRD-ETL] Fetch attempt {attempt+1} for {country}")
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            resp = await client.get(url, headers=headers, params=params)
                            resp.raise_for_status()
                            data = resp.json()
                            print(f"[DEBUG][EBIRD-ETL] {country}: {len(data)} records")
                            self.logger.info(f"[EBIRD-ETL] Fetched {len(data)} records from eBird for {country}")
                            # Deduplicate by obsId
                            for item in data:
                                obs_id = item.get("obsId") or item.get("subId")
                                if obs_id and obs_id not in seen_obs:
                                    seen_obs.add(obs_id)
                                    all_results.append(item)
                            break  # Success, break retry loop
                    except Exception as e:
                        print(f"[DEBUG][EBIRD-ETL] Fetch attempt {attempt+1} failed for {country}: {e}")
                        self.logger.warning(f"[EBIRD-ETL] Fetch attempt {attempt+1} failed for {country}: {e}")
                        await asyncio.sleep(2 * (attempt + 1))
            print(f"[DEBUG][EBIRD-ETL] Aggregated {len(all_results)} unique records from major countries.")
            return all_results
        else:
            url = f"{self.base_url}{region_code}/recent/{species_code}" if species_code else f"{self.base_url}{region_code}/recent"
            for attempt in range(retries):
                print(f"[DEBUG][EBIRD-ETL] Fetch attempt {attempt+1} for {region_code}")
                try:
                    async with httpx.AsyncClient(timeout=10) as client:
                        resp = await client.get(url, headers=headers, params=params)
                        resp.raise_for_status()
                        print(f"[DEBUG][EBIRD-ETL] Response status: {resp.status_code}")
                        print(f"[DEBUG][EBIRD-ETL] Response JSON length: {len(resp.json())}")
                        self.logger.info(f"[EBIRD-ETL] Fetched {len(resp.json())} records from eBird for {region_code}")
                        return resp.json()
                except Exception as e:
                    print(f"[DEBUG][EBIRD-ETL] Fetch attempt {attempt+1} failed: {e}")
                    self.logger.warning(f"[EBIRD-ETL] Fetch attempt {attempt+1} failed: {e}")
                    await asyncio.sleep(2 * (attempt + 1))
            print(f"[DEBUG][EBIRD-ETL] All fetch attempts failed for {region_code}")
            self.logger.error(f"[EBIRD-ETL] All fetch attempts failed for {region_code}")
            return []

    def normalize(self, raw_data: Any) -> List[dict]:
        print(f"[DEBUG][EBIRD-ETL] Normalizing raw data, input length: {len(raw_data) if raw_data else 0}")
        normalized = []
        for idx, item in enumerate(raw_data):
            if idx < 3:
                print(f"[DEBUG][EBIRD-ETL] Raw item {idx}: {item}")
            obs_id = item.get("subId") or item.get("obsId")
            if not obs_id:
                continue
            # Always fill 'species' with comName, sciName, or empty string
            species = item.get("comName") or item.get("sciName") or ""
            normalized.append({
                "species": species,
                "sci_name": item.get("sciName"),
                "lat": item.get("lat"),
                "lon": item.get("lng"),
                "date": item.get("obsDt"),
                "location": item.get("locName"),
                "how_many": item.get("howMany"),
                "obs_id": obs_id
            })
        print(f"[DEBUG][EBIRD-ETL] Normalized {len(normalized)} records.")
        self.logger.info(f"[EBIRD-ETL] Normalized {len(normalized)} records.")
        return normalized

    async def run_etl(self, region_code: str = "world", species: str = "", max_results: int = 100) -> List[dict]:
        print(f"[DEBUG][EBIRD-ETL] Starting ETL for region: {region_code}, species: {species}")
        self.logger.info(f"[EBIRD-ETL] Starting ETL for region: {region_code}, species: {species}")
        species_code = species
        if species:
            try:
                species_code = await self.get_species_code(species)
                print(f"[DEBUG][EBIRD-ETL] Resolved species '{species}' to code '{species_code}'")
            except Exception as e:
                print(f"[ERROR][EBIRD-ETL] {e}")
                self.logger.error(f"[EBIRD-ETL] {e}")
                await self.save_raw_data([])
                await self.save_normalized_data([])
                return []
        # If region_code is 'world', fetch from major countries and aggregate
        if region_code.lower() == "world":
            country_codes = [
                "US", "CA", "GB", "DE", "FR", "ES", "IT", "AU", "BR", "IN", "CN", "RU", "ZA", "MX", "AR", "JP"
            ]
            all_results = []
            seen_obs = set()
            for country in country_codes:
                raw = await self.fetch(country, species_code, max_results)
                for item in raw:
                    obs_id = item.get("obsId") or item.get("subId")
                    if obs_id and obs_id not in seen_obs:
                        seen_obs.add(obs_id)
                        all_results.append(item)
            print(f"[DEBUG][EBIRD-ETL] Aggregated {len(all_results)} unique records from major countries.")
            # Deduplicate before normalizing
            seen_ids = set()
            unique_results = []
            for item in all_results:
                obs_id = item.get("subId") or item.get("obsId")
                if obs_id and obs_id not in seen_ids:
                    seen_ids.add(obs_id)
                    unique_results.append(item)
            print(f"[DEBUG][EBIRD-ETL] After deduplication: {len(unique_results)} unique records.")
            normalized = self.normalize(unique_results)
            await self.save_raw_data(unique_results)
            await self.save_normalized_data(normalized)
            print(f"[DEBUG][EBIRD-ETL] ETL complete for world, species: {species}")
            self.logger.info(f"[EBIRD-ETL] ETL complete for world, species: {species}")
            return normalized
        else:
            raw = await self.fetch(region_code, species_code, max_results)
            print(f"[DEBUG][EBIRD-ETL] Raw fetch result length: {len(raw) if raw else 0}")
            normalized = self.normalize(raw)
            print(f"[DEBUG][EBIRD-ETL] Normalized result length: {len(normalized) if normalized else 0}")
            await self.save_raw_data(raw)
            await self.save_normalized_data(normalized)
            print(f"[DEBUG][EBIRD-ETL] ETL complete for {region_code}, species: {species}")
            self.logger.info(f"[EBIRD-ETL] ETL complete for {region_code}, species: {species}")
            return normalized

    async def save_raw_data(self, raw_data: Any):
        await self.store(raw_data, status=ETLStatus.SUCCESS, metadata={"type": "raw"})

    async def save_normalized_data(self, normalized: List[dict]):
        await self.store(normalized, status=ETLStatus.SUCCESS, metadata={"type": "normalized"})
