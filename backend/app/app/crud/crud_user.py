from typing import Any, Dict, Union

from motor.core import AgnosticDatabase
from bson import ObjectId

from app.core.security import get_password_hash, verify_password
from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserInDB, UserUpdate


# ODM, Schema, Schema
class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def __init__(self, model):
        super().__init__(model, "users")

    async def get_by_email(self, db: AgnosticDatabase, *, email: str) -> User | None:
        collection = self._get_collection(db)
        doc = await collection.find_one({"email": email})
        if doc:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            return self.model(**doc)
        return None

    async def create(self, db: AgnosticDatabase, *, obj_in: UserCreate) -> User:
        collection = self._get_collection(db)
        user_data = {
            "email": obj_in.email,
            "hashed_password": get_password_hash(obj_in.password) if obj_in.password is not None else None,
            "full_name": obj_in.full_name,
            "is_superuser": obj_in.is_superuser,
            "is_active": True,
            "latitude": obj_in.latitude,
            "longitude": obj_in.longitude,
            "refresh_tokens": []
        }

        result = await collection.insert_one(user_data)
        user_data["id"] = str(result.inserted_id)
        return self.model(**user_data)

    async def update(self, db: AgnosticDatabase, *, db_obj: User, obj_in: Union[UserUpdate, Dict[str, Any]]) -> User:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        if update_data.get("password"):
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            update_data["hashed_password"] = hashed_password
        return await super().update(db, db_obj=db_obj, obj_in=update_data)

    async def authenticate(self, db: AgnosticDatabase, *, email: str, password: str) -> User | None:
        user = await self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(plain_password=password, hashed_password=user.hashed_password):
            return None
        return user

    async def toggle_user_state(self, db: AgnosticDatabase, *, obj_in: Union[UserUpdate, Dict[str, Any]]) -> User:
        db_obj = await self.get_by_email(db, email=obj_in.email)
        if not db_obj:
            return None
        return await self.update(db=db, db_obj=db_obj, obj_in=obj_in)

    @staticmethod
    def has_password(user: User) -> bool:
        return user.hashed_password is not None

    @staticmethod
    def is_active(user: User) -> bool:
        return user.is_active

    @staticmethod
    def is_superuser(user: User) -> bool:
        return user.is_superuser


user = CRUDUser(User)
