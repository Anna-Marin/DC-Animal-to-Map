from typing import Any, Dict, Generic, Type, TypeVar, Union

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from motor.core import AgnosticDatabase
from bson import ObjectId

from app.db.base_class import Base
from app.core.config import settings

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType], collection_name: str):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD) using Motor.

        **Parameters**

        * `model`: A Pydantic model class
        * `collection_name`: MongoDB collection name
        """
        self.model = model
        self.collection_name = collection_name

    def _get_collection(self, db: AgnosticDatabase):
        return db[self.collection_name]

    async def get(self, db: AgnosticDatabase, id: str) -> ModelType | None:
        collection = self._get_collection(db)
        doc = await collection.find_one({"_id": ObjectId(id)})
        if doc:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            return self.model(**doc)
        return None

    async def get_multi(self, db: AgnosticDatabase, *, page: int = 0, page_break: bool = False) -> list[ModelType]:
        collection = self._get_collection(db)
        skip = page * settings.MULTI_MAX if page_break else 0
        limit = settings.MULTI_MAX if page_break else 0
        
        cursor = collection.find()
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

    async def create(self, db: AgnosticDatabase, *, obj_in: CreateSchemaType) -> ModelType:
        collection = self._get_collection(db)
        obj_in_data = jsonable_encoder(obj_in)
        result = await collection.insert_one(obj_in_data)
        obj_in_data["id"] = str(result.inserted_id)
        return self.model(**obj_in_data)

    async def update(
        self, db: AgnosticDatabase, *, db_obj: ModelType, obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        collection = self._get_collection(db)
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        # Update in database
        update_dict = jsonable_encoder(db_obj)
        if "id" in update_dict:
            obj_id = ObjectId(update_dict["id"])
            del update_dict["id"]
        else:
            raise ValueError("Object must have an id to update")
            
        await collection.update_one({"_id": obj_id}, {"$set": update_dict})
        return db_obj

    async def remove(self, db: AgnosticDatabase, *, id: str) -> ModelType:
        collection = self._get_collection(db)
        obj = await self.get(db, id=id)
        if obj:
            await collection.delete_one({"_id": ObjectId(id)})
        return obj
