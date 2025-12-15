from __future__ import annotations
from pydantic import Field

from app.db.base_class import Base


class Token(Base):
    token: str
    authenticates_id: str
