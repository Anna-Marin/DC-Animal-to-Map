from typing import Any, List

from fastapi import APIRouter, Depends
from motor.core import AgnosticDatabase

from app import crud, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.LoginLog])
async def read_login_logs(
    db: AgnosticDatabase = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: schemas.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve login logs.
    """
    cursor = crud.login_log._get_collection(db).find().sort("timestamp", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        
        # Ensure timestamp exists, use a default if missing
        if "timestamp" not in doc:
            from datetime import datetime
            doc["timestamp"] = datetime.now()
        
        # Ensure success field exists
        if "success" not in doc:
            doc["success"] = True
        
        # Handle legacy documents: if they have user_id but not email, fetch email from user
        if "email" not in doc and "user_id" in doc:
            user = await crud.user.get(db, id=doc["user_id"])
            if user:
                doc["email"] = user.email
            else:
                doc["email"] = "unknown@example.com"
            # Remove old user_id field
            del doc["user_id"]
        elif "email" not in doc:
            doc["email"] = "unknown@example.com"
            
        results.append(schemas.LoginLog(**doc))
    return results
