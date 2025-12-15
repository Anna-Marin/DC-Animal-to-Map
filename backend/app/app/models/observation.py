from datetime import datetime
from typing import Optional
from pydantic import Field

from app.db.base_class import Base

class Observation(Base):
    user_id: str
    user_name: str
    species: str
    confidence: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    image: bytes
    image_mime_type: str = "image/jpeg"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    country_code: Optional[str] = None
