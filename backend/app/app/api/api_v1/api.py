from fastapi import APIRouter


from app.api.api_v1.endpoints import login, users, image_upload, disl, ebird_taxonomy, maps

api_router = APIRouter()
api_router.include_router(login.router, prefix="/login", tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(image_upload.router, tags=["animal-mapping"])
api_router.include_router(disl.router, prefix="/etl", tags=["etl"])
api_router.include_router(ebird_taxonomy.router, prefix="/ebird", tags=["ebird-taxonomy"])
api_router.include_router(maps.router, prefix="/maps", tags=["maps"])
