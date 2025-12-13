import httpx
from fastapi import APIRouter, Query
from typing import List

router = APIRouter()

@router.get("/ebird/species-codes")
async def get_species_codes(query: str = Query("", description="Common or scientific name, partial allowed")) -> List[dict]:
    """
    Search eBird taxonomy for species codes by common or scientific name (partial match).
    """
    taxonomy_url = "https://api.ebird.org/v2/ref/taxonomy/ebird"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(taxonomy_url, params={"fmt": "json"})
        resp.raise_for_status()
        taxonomy = resp.json()
    results = []
    q = query.lower()
    for entry in taxonomy:
        if q in entry.get("comName", "").lower() or q in entry.get("sciName", "").lower():
            results.append({
                "comName": entry.get("comName"),
                "sciName": entry.get("sciName"),
                "speciesCode": entry.get("speciesCode")
            })
    return results
