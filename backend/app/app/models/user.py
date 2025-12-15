from __future__ import annotations
from typing import TYPE_CHECKING, Any, Optional
from datetime import datetime
from pydantic import EmailStr, Field

from app.db.base_class import Base

if TYPE_CHECKING:
    from . import Token  # noqa: F401


def datetime_now_sec():
    return datetime.now().replace(microsecond=0)


class User(Base):
    created: datetime = Field(default_factory=datetime_now_sec)
    modified: datetime = Field(default_factory=datetime_now_sec)
    full_name: str = Field(default="")
    email: EmailStr
    hashed_password: str
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)
    refresh_tokens: list[str] = Field(default_factory=list)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    location: Optional[str] = Field(default=None)
