from app.core.config import settings
from app.__version__ import __version__
from motor import motor_asyncio, core
from pymongo.driver_info import DriverInfo

DRIVER_INFO = DriverInfo(name="full-stack-fastapi-mongodb", version=__version__)


import threading

class _MongoClientSingleton:
    mongo_client: motor_asyncio.AsyncIOMotorClient | None
    _instance = None
    _lock = threading.Lock()

import threading

class _MongoClientSingleton:
    mongo_client: motor_asyncio.AsyncIOMotorClient | None
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    # Create instance and client locally first
                    instance = super(_MongoClientSingleton, cls).__new__(cls)
                    instance.mongo_client = motor_asyncio.AsyncIOMotorClient(
                        settings.MONGO_DATABASE_URI, driver=DRIVER_INFO
                    )
                    # Assign to class variable only after fully initialized
                    cls._instance = instance
        return cls._instance


def MongoDatabase() -> core.AgnosticDatabase:
    return _MongoClientSingleton().mongo_client[settings.MONGO_DATABASE]


async def ping():
    await MongoDatabase().command("ping")


__all__ = ["MongoDatabase", "ping"]
