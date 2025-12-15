from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId

# Base class for MongoDB documents using Motor
class Base(BaseModel):
    id: Optional[str] = None
    
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }
