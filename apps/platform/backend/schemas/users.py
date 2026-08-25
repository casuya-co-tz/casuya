from pydantic import BaseModel, field_validator


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    phone: str | None
    role: str
    is_active: bool


class UserUpdateRequest(BaseModel):
    phone: str | None = None
    full_name: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is not None and v.strip():
            cleaned = v.strip()
            if not all(c.isdigit() or c in "+-() " for c in cleaned):
                raise ValueError("Phone number contains invalid characters")
            return cleaned
        return None
