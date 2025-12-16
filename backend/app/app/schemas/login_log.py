from datetime import datetime
from pydantic import BaseModel

class LoginLogBase(BaseModel):
    email: str
    success: bool = True

class LoginLogCreate(LoginLogBase):
    pass

class LoginLog(LoginLogBase):
    id: str
    timestamp: datetime

    class Config:
        from_attributes = True
