
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.disl.ebird import EBirdProvider
from app.db.session import MongoDatabase
from datetime import datetime, timedelta

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

async def cleanup_old_login_logs():
    """Delete login logs older than 1 month"""
    logger.info("Starting monthly login logs cleanup")
    try:
        db = MongoDatabase()
        one_month_ago = datetime.utcnow() - timedelta(days=30)
        
        result = await db["login_logs"].delete_many({
            "timestamp": {"$lt": one_month_ago}
        })
        
        logger.info(f"Deleted {result.deleted_count} login logs older than 30 days")
    except Exception as e:
        logger.error(f"Failed to cleanup login logs: {str(e)}")

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
    
    # Add monthly login logs cleanup job (first day of month at 02:00)
    scheduler.add_job(
        cleanup_old_login_logs,
        trigger=CronTrigger(day=1, hour=2, minute=0),  # First day of month at 02:00
        id="monthly_login_logs_cleanup",
        name="Monthly Login Logs Cleanup",
        replace_existing=True
    )
    
    logger.info("APScheduler configured with daily eBird collection and monthly cleanup jobs")
    return scheduler
