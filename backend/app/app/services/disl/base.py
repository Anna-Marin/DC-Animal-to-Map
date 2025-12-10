import logging
from abc import ABC, abstractmethod
from typing import Any, Optional
from datetime import datetime
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.models.raw_data import RawData, DataSource, ETLStatus
from app.db.session import MongoDatabase, get_engine

logger = logging.getLogger(__name__)

class ETLProvider(ABC):
    def __init__(self, source: DataSource):
        self.source = source
        self.engine = get_engine()

    @abstractmethod
    async def fetch(self) -> Any:
        """Fetch data from the external API."""
        pass

    @abstractmethod
    def normalize(self, raw_data: Any) -> Any:
        """Normalize the fetched data."""
        pass

    async def store(self, data: Any, status: ETLStatus, error: Optional[str] = None, metadata: Optional[dict] = None):
        """Store the data in the database."""
        raw_data_entry = RawData(
            source=self.source,
            data=data,
            fetched_at=datetime.utcnow(),
            status=status,
            error_message=error,
            metadata=metadata or {}
        )
        await self.engine.save(raw_data_entry)
        logger.info(f"Stored data for {self.source} with status {status}")

    async def run(self):
        """Run the full ETL process."""
        logger.info(f"Starting ETL for {self.source}")
        try:
            raw_data = await self.fetch()
            normalized_data = self.normalize(raw_data)
            await self.store(normalized_data, ETLStatus.SUCCESS)
            return {"status": "success", "data_count": len(normalized_data) if isinstance(normalized_data, list) else 1}
        except Exception as e:
            logger.error(f"ETL failed for {self.source}: {str(e)}")
            await self.store(None, ETLStatus.FAILED, error=str(e))
            return {"status": "failed", "error": str(e)}

    @staticmethod
    def get_client() -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=30.0)
