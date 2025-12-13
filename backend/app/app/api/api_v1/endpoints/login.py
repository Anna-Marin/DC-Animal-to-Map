from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from motor.core import AgnosticDatabase

from app import crud, schemas
from app.api import deps
from app.core import security

router = APIRouter()


@router.post("/oauth", response_model=schemas.Token)
async def login_with_oauth2(
    db: AgnosticDatabase = Depends(deps.get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = await crud.user.authenticate(db, email=form_data.username, password=form_data.password)
    if not form_data.password or not user or not crud.user.is_active(user):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    refresh_token = security.create_refresh_token(subject=user.id)
    await crud.token.create(db=db, obj_in=refresh_token, user_obj=user)
    
    return {
        "access_token": security.create_access_token(subject=user.id),
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=schemas.Token)
async def refresh_token(
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user = Depends(deps.get_refresh_user),
) -> Any:
    """
    Refresh tokens for future requests.
    """
    refresh_token = security.create_refresh_token(subject=current_user.id)
    await crud.token.create(db=db, obj_in=refresh_token, user_obj=current_user)
    
    return {
        "access_token": security.create_access_token(subject=current_user.id),
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/logout", response_model=schemas.Msg)
async def logout(
    db: AgnosticDatabase = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user),
) -> Any:
    """
    Logout user by invalidating current token.
    """
    return {"msg": "Successfully logged out"}
