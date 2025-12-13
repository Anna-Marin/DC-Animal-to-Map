from typing_extensions import Annotated
from pydantic import BaseModel, ConfigDict, Field, EmailStr, StringConstraints, field_validator, SecretStr
from odmantic import ObjectId


class UserLogin(BaseModel):
    username: str
    password: str


# Shared properties
class UserBase(BaseModel):
    email: EmailStr | None = None
    is_active: bool | None = True
    is_superuser: bool | None = False
    full_name: str = ""
    latitude: float | None = None
    longitude: float | None = None


# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    password: Annotated[str | None, StringConstraints(min_length=8, max_length=64)] = None # noqa


# Properties to receive via API on update
class UserUpdate(UserBase):
    original: Annotated[str | None, StringConstraints(min_length=8, max_length=64)] = None # noqa
    password: Annotated[str | None, StringConstraints(min_length=8, max_length=64)] = None  # noqa


class UserInDBBase(UserBase):
    id: ObjectId | None = None
    model_config = ConfigDict(from_attributes=True)


# Additional properties to return via API
class User(UserInDBBase):
    hashed_password: bool = Field(default=False, alias="password")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator("hashed_password", mode="before")
    def evaluate_hashed_password(cls, hashed_password):
        if hashed_password:
            return True
        return False


# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: SecretStr
