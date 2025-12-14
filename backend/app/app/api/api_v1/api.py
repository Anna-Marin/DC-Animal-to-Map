from fastapi import APIRouter

from app.api.api_v1.endpoints import login, users, image_upload, maps, observations, analytics, disl

api_router = APIRouter()
api_router.include_router(login.router, prefix="/login", tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(image_upload.router, tags=["animal-mapping"])
api_router.include_router(maps.router, prefix="/maps", tags=["maps"])
api_router.include_router(observations.router, prefix="/observations", tags=["observations"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(disl.router, prefix="/etl", tags=["etl"])
