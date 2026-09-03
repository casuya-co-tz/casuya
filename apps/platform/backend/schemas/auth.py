from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "student"
    phone: str | None = None
    accessibility_prefs: dict | None = None


class LoginRequest(BaseModel):
    email: str
    password: str
    keep_logged_in: bool = False


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str | None = None
    phone: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class CompleteRegistrationRequest(BaseModel):
    user_id: str
    role: str  # "student" or "teacher"


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    accessibility_prefs: dict | None = None
