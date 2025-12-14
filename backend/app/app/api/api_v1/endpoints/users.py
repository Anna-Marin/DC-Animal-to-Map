from typing import Any, List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic.networks import EmailStr
from motor.core import AgnosticDatabase

from app import crud, models, schemas
from app.api import deps
from app.core.config import settings
from app.core import security

router = APIRouter()


@router.post("/", response_model=schemas.User)
async def create_user_profile(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    password: str = Body(...),
    email: EmailStr = Body(...),
    full_name: str = Body(""),
    latitude: float | None = Body(None),
    longitude: float | None = Body(None),
    location: str | None = Body(None),
) -> Any:
    """
    Create new user without the need to be logged in.
    """
    user = await crud.user.get_by_email(db, email=email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="This username is not available.",
        )
        
    if location and (latitude is None or longitude is None):
        from app.services.disl.maps import OpenStreetMapsProvider
        provider = OpenStreetMapsProvider()
        coords = await provider.geocode_single(location)
        if coords:
            latitude = coords[0]
            longitude = coords[1]
            
    # Create user auth
    user_in = schemas.UserCreate(
        password=password, 
        email=email, 
        full_name=full_name, 
        latitude=latitude, 
        longitude=longitude,
        location=location 
    )
    user = await crud.user.create(db, obj_in=user_in)
    return user


@router.put("/", response_model=schemas.User)
async def update_user(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    obj_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update user.
    """
    if current_user.hashed_password:
        user = await crud.user.authenticate(db, email=current_user.email, password=obj_in.original)
        if not obj_in.original or not user:
            raise HTTPException(status_code=400, detail="Unable to authenticate this update.")
    current_user_data = jsonable_encoder(current_user)
    user_in = schemas.UserUpdate(**current_user_data)
    if obj_in.password is not None:
        user_in.password = obj_in.password
    if obj_in.full_name is not None:
        user_in.full_name = obj_in.full_name
    if obj_in.email is not None:
        check_user = await crud.user.get_by_email(db, email=obj_in.email)
        if check_user and check_user.email != current_user.email:
            raise HTTPException(
                status_code=400,
                detail="This username is not available.",
            )
        user_in.email = obj_in.email
    if obj_in.latitude is not None:
        user_in.latitude = obj_in.latitude
    if obj_in.longitude is not None:
        user_in.longitude = obj_in.longitude
        
    # Handle location update and server-side geocoding fallback
    if hasattr(obj_in, 'location') and obj_in.location is not None:
        user_in.location = obj_in.location
        # If location is provided but coords are not (or explicitly None?), attempt geocode
        if obj_in.latitude is None or obj_in.longitude is None:
             from app.services.disl.maps import OpenStreetMapsProvider
             provider = OpenStreetMapsProvider()
             coords = await provider.geocode_single(obj_in.location)
             if coords:
                 user_in.latitude = coords[0]
                 user_in.longitude = coords[1]
                
    user = await crud.user.update(db, db_obj=current_user, obj_in=user_in)
    return user


@router.get("/", response_model=schemas.User)
async def read_user(
    *,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.get("/all", response_model=List[schemas.User])
async def read_all_users(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    page: int = 0,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve all current users.
    """
    return await crud.user.get_multi(db=db, page=page)


@router.post("/toggle-state", response_model=schemas.Msg)
async def toggle_state(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Toggle user state (moderator function)
    """
    response = await crud.user.toggle_user_state(db=db, obj_in=user_in)
    if not response:
        raise HTTPException(
            status_code=400,
            detail="Invalid request.",
        )
    return {"msg": "User state toggled successfully."}


@router.post("/create", response_model=schemas.User)
async def create_user(
    *,
    db: AgnosticDatabase = Depends(deps.get_db),
    user_in: schemas.UserCreate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create new user (moderator function).
    """
    user = await crud.user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = await crud.user.create(db, obj_in=user_in)
    return user


@router.delete("/{user_id}", response_model=schemas.Msg)
async def delete_user(
    user_id: str,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Users can delete their own account, admins can delete any account.
    """
    from bson import ObjectId
    # Check if user is deleting their own account or is admin
    if str(current_user.id) != user_id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    user = await crud.user.get(db, id=ObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete: set is_active to False
    user.is_active = False
    await crud.user.update(db, db_obj=user, obj_in={"is_active": False})
    return {"msg": f"User {user_id} deleted successfully"}


@router.put("/{user_id}/role", response_model=schemas.User)
async def update_user_role(
    user_id: str,
    role: str,
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update user role (admin only).
    """
    from bson import ObjectId
    user = await crud.user.get(db, id=ObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update role (is_superuser field)
    is_superuser = role.lower() == "admin"
    await crud.user.update(db, db_obj=user, obj_in={"is_superuser": is_superuser})
    user.is_superuser = is_superuser
    return user


@router.get("/tester", response_model=schemas.Msg)
async def test_endpoint() -> Any:
    """
    Test current endpoint.
    """
    return {"msg": "Message returned ok."}
