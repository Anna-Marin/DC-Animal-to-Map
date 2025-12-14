
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.disl.ebird import EBirdProvider

logger = logging.getLogger(__name__)

# Important countries for daily eBird data collection
IMPORTANT_COUNTRIES = [
    "US",  # United States
    "ES",  # Spain
    "GB",  # United Kingdom
    "FR",  # France
    "DE",  # Germany
    "IT",  # Italy
    "CA",  # Canada
    "AU",  # Australia
    "BR",  # Brazil
    "MX",  # Mexico
]

async def run_daily_ebird_collection():
    logger.info("Starting daily eBird data collection cronjob")
    provider = EBirdProvider()
    
    for country in IMPORTANT_COUNTRIES:
        try:
            logger.info(f"Fetching eBird data for {country}")
            await provider.run_etl(region_code=country, species="", max_results=100)
            logger.info(f"Successfully collected data for {country}")
        except Exception as e:
            logger.error(f"Failed to collect data for {country}: {str(e)}")
    
    logger.info("Daily eBird data collection completed")

def setup_scheduler():
    scheduler = AsyncIOScheduler()
    
    # Add daily eBird collection job at 00:00
    scheduler.add_job(
        run_daily_ebird_collection,
        trigger=CronTrigger(hour=0, minute=0),  # Every day at 00:00
        id="daily_ebird_collection",
        name="Daily eBird Historical Data Collection",
        replace_existing=True
    )
    
    logger.info("APScheduler configured with daily eBird collection job")
    return scheduler
