from app.crud.base import CRUDBase
from app.models.login_log import LoginLog
from app.schemas.login_log import LoginLogCreate, LoginLog as LoginLogSchema

from datetime import datetime
from fastapi.encoders import jsonable_encoder
from motor.core import AgnosticDatabase

class CRUDLoginLog(CRUDBase[LoginLog, LoginLogCreate, LoginLogSchema]):
    async def create(self, db: AgnosticDatabase, *, obj_in: LoginLogCreate) -> LoginLog:
        collection = self._get_collection(db)
        obj_in_data = jsonable_encoder(obj_in)
        obj_in_data["timestamp"] = datetime.now()
        result = await collection.insert_one(obj_in_data)
        obj_in_data["id"] = str(result.inserted_id)
        return self.model(**obj_in_data)

login_log = CRUDLoginLog(LoginLog, "login_logs")
