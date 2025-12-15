from __future__ import annotations
from motor.core import AgnosticDatabase
from bson import ObjectId

from app.crud.base import CRUDBase
from app.models import User, Token
from app.schemas import RefreshTokenCreate, RefreshTokenUpdate
from app.core.config import settings
from app.db.session import MongoDatabase


class CRUDToken(CRUDBase[Token, RefreshTokenCreate, RefreshTokenUpdate]):
    def __init__(self, model):
        super().__init__(model, "tokens")
    
    # Everything is user-dependent
    async def create(self, db: AgnosticDatabase, *, obj_in: str, user_obj: User) -> Token:
        token_collection = db["tokens"]
        user_collection = db["users"]
        
        # Check if token already exists
        existing = await token_collection.find_one({"token": obj_in})
        if existing:
            if existing["authenticates_id"] != user_obj.id:
                raise ValueError("Token mismatch between key and user.")
            existing["id"] = str(existing["_id"])
            del existing["_id"]
            return self.model(**existing)
        
        # Create new token
        token_data = {"token": obj_in, "authenticates_id": user_obj.id}
        result = await token_collection.insert_one(token_data)
        token_id = str(result.inserted_id)
        
        # Update user's refresh_tokens list
        await user_collection.update_one(
            {"_id": ObjectId(user_obj.id)},
            {"$push": {"refresh_tokens": token_id}}
        )
        
        token_data["id"] = token_id
        return self.model(**token_data)

    async def get(self, db: AgnosticDatabase, *, user: User, token: str) -> Token:
        collection = db["tokens"]
        doc = await collection.find_one({"token": token, "authenticates_id": user.id})
        if doc:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            return self.model(**doc)
        return None

    async def get_multi(self, db: AgnosticDatabase, *, user: User, page: int = 0, page_break: bool = False) -> list[Token]:
        collection = db["tokens"]
        skip = page * settings.MULTI_MAX if page_break else 0
        limit = settings.MULTI_MAX if page_break else 0
        
        cursor = collection.find({"authenticates_id": user.id})
        if skip:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
            
        results = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            results.append(self.model(**doc))
        return results

    async def remove(self, db: AgnosticDatabase, *, db_obj: Token) -> None:
        token_collection = db["tokens"]
        user_collection = db["users"]
        
        # Remove token ID from user's refresh_tokens
        await user_collection.update_many(
            {"refresh_tokens": db_obj.id},
            {"$pull": {"refresh_tokens": db_obj.id}}
        )
        
        # Delete the token
        await token_collection.delete_one({"_id": ObjectId(db_obj.id)})


token = CRUDToken(Token)
