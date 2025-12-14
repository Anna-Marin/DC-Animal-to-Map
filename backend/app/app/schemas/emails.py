from pydantic import BaseModel, EmailStr, SecretStr


class EmailContent(BaseModel):
    email: EmailStr
    subject: str
    content: str
