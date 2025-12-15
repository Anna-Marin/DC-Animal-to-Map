from pydantic import BaseModel, ConfigDict, SecretStr


class RefreshTokenBase(BaseModel):
    token: SecretStr
    authenticates: str | None = None


class RefreshTokenCreate(RefreshTokenBase):
    authenticates: str


class RefreshTokenUpdate(RefreshTokenBase):
    pass


class RefreshToken(RefreshTokenUpdate):
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str


class TokenPayload(BaseModel):
    sub: str | None = None
    refresh: bool | None = False


class WebToken(BaseModel):
    claim: str
