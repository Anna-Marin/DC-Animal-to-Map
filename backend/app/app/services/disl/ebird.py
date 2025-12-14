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

    async def get_species_codes(self, common_name: str, limit: int = 5) -> List[str]:
        if not self.taxonomy_cache:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(self.taxonomy_url, params={"fmt": "json"})
                resp.raise_for_status()
                self.taxonomy_cache = resp.json()
        
        name_l = common_name.lower()
        matches = []
        
        # Search for any species containing the name in common name
        for species in self.taxonomy_cache:
            # Prioritize exact match if possible, but collect all partials
            if name_l in species.get("comName", "").lower():
                matches.append(species)
            elif name_l in species.get("sciName", "").lower():
                matches.append(species)
        
        matches.sort(key=lambda x: (
            x.get("comName", "").lower() != name_l, # Exact match first (False < True)
            len(x.get("comName", "")) # Then shorter names
        ))
        
        codes = []
        seen = set()
        for m in matches:
            code = m.get("speciesCode")
            if code and code not in seen:
                codes.append(code)
                seen.add(code)
                if len(codes) >= limit:
                    break
                    
        if not codes:
            raise ValueError(f"Species '{common_name}' not found in eBird taxonomy.")
            
        return codes

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
        print(f"[DEBUG][EBIRD-ETL] Starting ETL for region: {region_code}, species query: {species}")
        self.logger.info(f"[EBIRD-ETL] Starting ETL for region: {region_code}, species query: {species}")
        
        species_codes = []
        if species:
            try:
                species_codes = await self.get_species_codes(species, limit=5)
                print(f"[DEBUG][EBIRD-ETL] Resolved '{species}' to {len(species_codes)} codes: {species_codes}")
            except Exception as e:
                print(f"[ERROR][EBIRD-ETL] {e}")
                
        if not species_codes:
            if species:
                return []
            else:
                species_codes = [""]

        # Aggregate results across all codes
        aggregated_results = []
        seen_global = set()

        for sp_code in species_codes:
            print(f"[DEBUG][EBIRD-ETL] Fetching for species code: {sp_code}")
            
            # If region_code is 'world', fetch from major countries
            if region_code.lower() == "world":
                country_codes = [
                    "US", "CA", "GB", "DE", "FR", "ES", "IT", "AU", "BR", "IN", "CN", "RU", "ZA", "MX", "AR", "JP"
                ]
                results_for_code = []
                for country in country_codes:
                    raw = await self.fetch(country, sp_code, max_results)
                    results_for_code.extend(raw)
                
                # Deduplicate this batch
                for item in results_for_code:
                    obs_id = item.get("subId") or item.get("obsId")
                    if obs_id and obs_id not in seen_global:
                        seen_global.add(obs_id)
                        aggregated_results.append(item)
            else:
                 raw = await self.fetch(region_code, sp_code, max_results)
                 for item in raw:
                    obs_id = item.get("subId") or item.get("obsId")
                    if obs_id and obs_id not in seen_global:
                        seen_global.add(obs_id)
                        aggregated_results.append(item)

        print(f"[DEBUG][EBIRD-ETL] Total unique aggregated records: {len(aggregated_results)}")
        
        if not aggregated_results:
             return []

        normalized = self.normalize(aggregated_results)
        await self.save_raw_data(aggregated_results)
        await self.save_normalized_data(normalized)
        
        self.logger.info(f"[EBIRD-ETL] ETL complete. Saved {len(normalized)} records.")
        return normalized

    async def save_raw_data(self, raw_data: Any):
        await self.store(raw_data, status=ETLStatus.SUCCESS, metadata={"type": "raw"})

    async def save_normalized_data(self, normalized: List[dict]):
        await self.store(normalized, status=ETLStatus.SUCCESS, metadata={"type": "normalized"})

    async def get_observations(self, species: str, days_back: int = 30) -> List[dict]:
        from datetime import datetime, timedelta
        from app.models.raw_data import RawData, DataSource

        thirty_days_ago = datetime.utcnow() - timedelta(days=days_back)
        
        def extract_obs(raw_docs):
            obs_list = []
            species_lower = species.lower()
            for r in raw_docs:
                if r.metadata and r.metadata.get('type') != 'normalized':
                    continue
                if isinstance(r.data, list):
                    for item in r.data:
                        if isinstance(item, dict):
                            item_species = (item.get('species') or '').lower()
                            item_sci_name = (item.get('sci_name') or '').lower()
                            if species_lower in item_species or species_lower in item_sci_name:
                                obs_list.append(item)
            return obs_list

        results = await self.engine.find(
            RawData,
            RawData.source == DataSource.EBIRD,
            RawData.fetched_at >= thirty_days_ago,
            sort=RawData.fetched_at.desc(),
            limit=50
        )
        
        observations = extract_obs(results)
        
        if not observations:
            self.logger.info(f"[EBIRD-PROVIDER] No cached observations for {species}, triggering ETL.")
            await self.run_etl(region_code="world", species=species, max_results=100)
            
            results = await self.engine.find(
                RawData,
                RawData.source == DataSource.EBIRD,
                RawData.fetched_at >= thirty_days_ago,
                sort=RawData.fetched_at.desc(),
                limit=50
            )
            observations = extract_obs(results)

        unique_obs = []
        seen = set()
        for obs in observations:
            obs_id = obs.get("obs_id")
            if obs_id and obs_id not in seen:
                seen.add(obs_id)
                unique_obs.append(obs)
                
        return unique_obs
