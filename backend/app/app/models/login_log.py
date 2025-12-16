from datetime import datetime
from pydantic import Field
from app.db.base_class import Base

def datetime_now_sec():
    return datetime.now().replace(microsecond=0)

class LoginLog(Base):
    email: str
    timestamp: datetime = Field(default_factory=datetime_now_sec)
    success: bool = Field(default=True)
