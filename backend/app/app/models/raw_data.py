from datetime import datetime
from typing import Any, Optional
from pydantic import Field
from enum import Enum

from app.db.base_class import Base

class DataSource(str, Enum):
    WILDLIFE = "wildlife"
    NINJAS = "ninjas"
    MAPS = "maps"
    EBIRD = "ebird"

class ETLStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"

class RawData(Base):
    source: DataSource
    data: Any  # Stores the raw/normalized JSON data
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    status: ETLStatus
    error_message: Optional[str] = None
    metadata: Optional[dict] = Field(default_factory=dict)
