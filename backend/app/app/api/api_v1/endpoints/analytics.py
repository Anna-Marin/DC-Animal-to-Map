from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta
from collections import defaultdict
from app.models.raw_data import RawData, DataSource
from app.models.user import User
from app.db.session import get_engine
from app.api import deps
from app.services.disl import NinjasProvider, WildlifeProvider, EBirdProvider
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/temporal-patterns")
async def get_temporal_patterns(
    species: Optional[str] = Query(None, description="Specific species name (optional, leave empty for all)"),
    days: int = Query(60, ge=7, le=365, description="Number of days to analyze"),
    include_habitat: bool = Query(True, description="Include habitat analysis from Wildlife/Ninjas APIs"),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    try:
        engine = get_engine()
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        ebird_data = await engine.find(
            RawData,
            RawData.source == DataSource.EBIRD,
            RawData.fetched_at >= cutoff_date,
            sort=RawData.fetched_at.asc(),
        )
        
        # Temporal aggregation structures
        hourly_counts = defaultdict(int)
        daily_counts = defaultdict(int)  # 0=Monday, 6=Sunday
        monthly_counts = defaultdict(int)
        total_observations = 0
        species_locations = set()  # For habitat correlation
        
        species_filter = species.lower() if species else None
        
        # Process eBird observations
        for record in ebird_data:
            if record.metadata.get("type") == "normalized" and isinstance(record.data, list):
                for obs in record.data:
                    # Filter by species if specified
                    if species_filter:
                        obs_species = (obs.get("species") or obs.get("comName") or obs.get("sci_name") or obs.get("sciName") or "").lower()
                        if species_filter not in obs_species:
                            continue
                    
                    date_str = obs.get("obsDt") or obs.get("date")
                    if not date_str:
                        continue
                    
                    try:
                        obs_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                        hourly_counts[obs_date.hour] += 1
                        daily_counts[obs_date.weekday()] += 1
                        monthly_counts[obs_date.month] += 1
                        total_observations += 1
                        
                        # Collect location for habitat analysis
                        loc = obs.get("locName", "")
                        if loc:
                            species_locations.add(loc.lower())
                    except Exception as e:
                        logger.warning(f"Failed to parse date {date_str}: {e}")
                        pass
        
        if total_observations == 0 and species:
            logger.info(f"[ANALYTICS] No local observations found for {species}, fetching from eBird API...")
            try:
                ebird_provider = EBirdProvider()
                # Run ETL for the species (defaults to "world" region)
                await ebird_provider.run_etl(species=species, max_results=100)
                
                # Re-query DB after fetch
                ebird_data = await engine.find(
                    RawData,
                    RawData.source == DataSource.EBIRD,
                    RawData.fetched_at >= cutoff_date,
                    sort=RawData.fetched_at.asc(),
                )
                
                # Reset counts and process again
                total_observations = 0
                species_locations.clear()
                hourly_counts.clear()
                daily_counts.clear()
                monthly_counts.clear()
                
                for record in ebird_data:
                    if record.metadata.get("type") == "normalized" and isinstance(record.data, list):
                        for obs in record.data:
                            if species_filter:
                                obs_species = (obs.get("species") or obs.get("comName") or obs.get("sci_name") or obs.get("sciName") or "").lower()
                                if species_filter not in obs_species:
                                    continue
                            
                            date_str = obs.get("obsDt") or obs.get("date")
                            if not date_str:
                                continue
                            
                            try:
                                obs_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                                hourly_counts[obs_date.hour] += 1
                                daily_counts[obs_date.weekday()] += 1
                                monthly_counts[obs_date.month] += 1
                                total_observations += 1
                                
                                loc = obs.get("locName", "")
                                if loc:
                                    species_locations.add(loc.lower())
                            except Exception as e:
                                pass
                                
                if total_observations > 0:
                     logger.info(f"[ANALYTICS] Successfully fetched and processed {total_observations} new observations for {species}")
                     data_sources_used.append("ebird_live")

            except Exception as e:
                logger.error(f"[ANALYTICS] Failed to fetch live eBird data: {e}", exc_info=True)

        
        logger.debug(f"[ANALYTICS] Processed {total_observations} eBird observations for species filter: {species_filter}")
        
        if total_observations == 0:
            logger.info(f"[ANALYTICS] No observations found for species: {species} in last {days} days")
            return {
                "species": species or "all species",
                "message": "No observations found in the specified period",
                "total_observations": 0,
                "data_sources_used": ["ebird"]
            }
        
        habitat_info = {}
        behavior_info = {}
        data_sources_used = ["ebird", "local_db"]
        
        if include_habitat and species:
            logger.debug(f"[ANALYTICS] Fetching habitat data for species: {species}")
            
            # Fetch from local DB first (Wildlife + Ninjas data)
            wildlife_data = await engine.find(
                RawData,
                RawData.source.in_([DataSource.WILDLIFE, DataSource.NINJAS]),
                RawData.fetched_at >= cutoff_date - timedelta(days=30),  # Recent data
                limit=50
            )
            
            logger.debug(f"[ANALYTICS] Found {len(wildlife_data)} Wildlife/Ninjas records in DB")
            
            species_lower = species.lower()
            
            for record in wildlife_data:
                if record.metadata.get("type") == "normalized" and isinstance(record.data, list):
                    # Process normalized data (list format)
                    for item in record.data:
                        name = item.get("name", "").lower()
                        
                        if species_lower in name:
                            logger.debug(f"[ANALYTICS] Found matching species in DB: {name} from {record.source}")
                            
                            if record.source == DataSource.NINJAS:
                                data_sources_used.append("ninjas_db")
                                characteristics = item.get("characteristics", {})
                                behavior_info["diet"] = characteristics.get("diet", "Unknown")
                                behavior_info["habitat"] = characteristics.get("habitat", "Unknown")
                                habitat_info["primary_habitat"] = characteristics.get("habitat", "Unknown")
            
            # If no local data, fetch from external APIs using ETL providers
            if not habitat_info and not behavior_info:
                logger.info(f"[ANALYTICS] No local data found, fetching from external APIs for: {species}")
                try:
                    # Use Ninjas ETL Provider
                    ninjas_provider = NinjasProvider()
                    raw_ninjas_data = await ninjas_provider.fetch(name=species)
                    
                    logger.debug(f"[ANALYTICS] Ninjas API raw response: {raw_ninjas_data}")
                    
                    if raw_ninjas_data:
                        # Normalize using ETL
                        normalized_ninjas = ninjas_provider.normalize(raw_ninjas_data)
                        
                        logger.debug(f"[ANALYTICS] Ninjas normalized data: {normalized_ninjas}")
                        
                        # Save to DB using ETL
                        await ninjas_provider.save(raw_ninjas_data, normalized_ninjas)
                        
                        # Extract info from normalized data
                        if normalized_ninjas and len(normalized_ninjas) > 0:
                            data_sources_used.append("ninjas_live")
                            animal = normalized_ninjas[0]
                            characteristics = animal.get("characteristics", {})
                            behavior_info["diet"] = characteristics.get("diet", "Unknown")
                            behavior_info["habitat"] = characteristics.get("habitat", "Unknown")
                            habitat_info["primary_habitat"] = characteristics.get("habitat", "Unknown")
                            
                            logger.info(f"[ANALYTICS] Successfully fetched and normalized Ninjas data for {species}")
                        
                except Exception as e:
                    logger.error(f"[ANALYTICS] Failed to fetch external API data: {e}", exc_info=True)
        
        logger.debug(f"[ANALYTICS] Calculating temporal patterns from {total_observations} observations")
        
        # Find peak times
        peak_hour = max(hourly_counts.items(), key=lambda x: x[1])[0] if hourly_counts else None
        peak_day = max(daily_counts.items(), key=lambda x: x[1])[0] if daily_counts else None
        peak_month = max(monthly_counts.items(), key=lambda x: x[1])[0] if monthly_counts else None
        
        logger.debug(f"[ANALYTICS] Peak times - Hour: {peak_hour}, Day: {peak_day}, Month: {peak_month}")
        
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        month_names = ["", "January", "February", "March", "April", "May", "June", 
                       "July", "August", "September", "October", "November", "December"]
        
        hourly_dist = {f"{h:02d}:00": round((hourly_counts.get(h, 0) / total_observations) * 100, 1) if total_observations else 0
                       for h in range(24)}
        
        daily_dist = {day_names[d]: round((daily_counts.get(d, 0) / total_observations) * 100, 1) if total_observations else 0
                      for d in range(7)}
        
        monthly_dist = {month_names[m]: round((monthly_counts.get(m, 0) / total_observations) * 100, 1) if total_observations else 0
                        for m in range(1, 13)}
        
        habitat_correlation = {}
        if habitat_info:
            primary_habitat = habitat_info.get("primary_habitat", "Unknown")
            habitat_correlation["primary_habitat"] = primary_habitat
            
            # Analyze if activity patterns match habitat type
            if peak_hour is not None:
                if "forest" in primary_habitat.lower():
                    if 6 <= peak_hour <= 9:
                        habitat_correlation["analysis"] = "Peak activity matches forest species behavior (early morning)"
                    else:
                        habitat_correlation["analysis"] = "Activity pattern differs from typical forest species"
                elif "urban" in primary_habitat.lower() or "city" in primary_habitat.lower():
                    habitat_correlation["analysis"] = "Urban species show varied activity throughout the day"
                else:
                    habitat_correlation["analysis"] = f"Activity pattern for {primary_habitat} habitat"
        
        
        recommendations = {}
        
        # Activity level
        if total_observations > 100:
            activity_level = "High"
        elif total_observations > 30:
            activity_level = "Moderate"
        else:
            activity_level = "Low"
        
        # Optimal time recommendation
        optimal_parts = []
        if peak_day is not None:
            optimal_parts.append(day_names[peak_day])
        if peak_hour is not None:
            optimal_parts.append(f"at {peak_hour:02d}:00")
        if habitat_info.get("primary_habitat"):
            optimal_parts.append(f"in {habitat_info['primary_habitat']} habitats")
        
        recommendations["optimal_time"] = " ".join(optimal_parts) if optimal_parts else "Insufficient data"
        recommendations["activity_level"] = activity_level
        recommendations["confidence"] = "High" if total_observations > 50 else "Moderate" if total_observations > 20 else "Low"
        
        # Add behavioral insights
        if behavior_info.get("diet"):
            if "carnivore" in behavior_info["diet"].lower():
                recommendations["tip"] = "Carnivorous species are often most active during hunting hours (dawn/dusk)"
            elif "herbivore" in behavior_info["diet"].lower():
                recommendations["tip"] = "Herbivorous species typically graze throughout daylight hours"
        
        return {
            "species": species or "all species",
            "period": f"{cutoff_date.strftime('%Y-%m-%d')} to {datetime.utcnow().strftime('%Y-%m-%d')}",
            "total_observations": total_observations,
            "data_sources_used": list(set(data_sources_used)),
            "best_observation_times": {
                "hour": f"{peak_hour:02d}:00" if peak_hour is not None else "Unknown",
                "day_of_week": day_names[peak_day] if peak_day is not None else "Unknown",
                "month": month_names[peak_month] if peak_month is not None else "Unknown"
            },
            "hourly_distribution": hourly_dist,
            "weekly_distribution": daily_dist,
            "seasonal_distribution": monthly_dist,
            "habitat_correlation": habitat_correlation if habitat_correlation else None,
            "species_behavior": behavior_info if behavior_info else None,
            "recommendations": recommendations,
            "data_quality": {
                "observation_count": total_observations,
                "unique_locations": len(species_locations),
                "date_range_days": days,
                "external_apis_used": "wildlife" in data_sources_used or "ninjas" in data_sources_used or "ninjas_live" in data_sources_used
            }
        }
        
    except Exception as e:
        logger.error(f"Temporal patterns error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
