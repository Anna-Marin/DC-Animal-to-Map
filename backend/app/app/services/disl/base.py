import logging
from abc import ABC, abstractmethod
from typing import Any, Optional
from datetime import datetime
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.models.raw_data import RawData, DataSource, ETLStatus
from app.db.session import MongoDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)

class ETLProvider(ABC):
    def __init__(self, source: DataSource):
        self.source = source
        self.db = MongoDatabase()

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
        raw_data_doc = {
            "source": self.source.value,
            "data": data,
            "fetched_at": datetime.utcnow(),
            "status": status.value,
            "error_message": error,
            "metadata": metadata or {}
        }
        await self.db["raw_data"].insert_one(raw_data_doc)
        logger.info(f"Stored data for {self.source} with status {status}")

    async def run(self):
        """Run the full ETL process."""
        self.log_info(f"Starting ETL for {self.source}")
        try:
            raw_data = await self.fetch()
            normalized_data = self.normalize(raw_data)
            await self.store(normalized_data, ETLStatus.SUCCESS)
            self.log_info(f"ETL completed successfully with {len(normalized_data) if isinstance(normalized_data, list) else 1} items")
            return {"status": "success", "data_count": len(normalized_data) if isinstance(normalized_data, list) else 1}
        except Exception as e:
            self.log_error(f"ETL failed: {str(e)}")
            await self.store(None, ETLStatus.FAILED, error=str(e))
            return {"status": "failed", "error": str(e)}


    def get_logger(self):
        return logging.getLogger(f"app.services.disl.{self.source.value}")
    
    def log_info(self, message: str):
        self.get_logger().info(f"[{self.source.value}] {message}")
    
    def log_warning(self, message: str):
        self.get_logger().warning(f"[{self.source.value}] {message}")
    
    def log_error(self, message: str):
        self.get_logger().error(f"[{self.source.value}] {message}")

    @staticmethod
    def get_client() -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=30.0)
