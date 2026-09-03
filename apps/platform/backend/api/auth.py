from fastapi import APIRouter, HTTPException

from backend.schemas.auth import (
    AuthResponse,
    CompleteRegistrationRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from backend.services.auth_service import (
    authenticate_user,
    complete_registration,
    forgot_password,
    refresh_access_token,
    register_user,
    reset_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
@router.post("/register/", response_model=AuthResponse)
def register(body: RegisterRequest):
    try:
        return register_user(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            role=body.role,
            phone=body.phone,
            accessibility_prefs=body.accessibility_prefs,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {e}")


@router.post("/login", response_model=AuthResponse)
@router.post("/login/", response_model=AuthResponse)
def login(body: LoginRequest):
    try:
        return authenticate_user(
            email=body.email, password=body.password, keep_logged_in=body.keep_logged_in
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {e}")


@router.post("/refresh")
@router.post("/refresh/")
def refresh(body: RefreshTokenRequest):
    try:
        return refresh_access_token(body.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")


@router.post("/forgot-password")
@router.post("/forgot-password/")
def forgot_password_endpoint(body: ForgotPasswordRequest):
    try:
        return forgot_password(email=body.email, phone=body.phone)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {e}")


@router.post("/reset-password")
@router.post("/reset-password/")
def reset_password_endpoint(body: ResetPasswordRequest):
    try:
        return reset_password(token=body.token, new_password=body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {e}")


@router.post("/complete-registration", response_model=AuthResponse)
@router.post("/complete-registration/", response_model=AuthResponse)
def complete_registration_endpoint(body: CompleteRegistrationRequest):
    try:
        return complete_registration(user_id=body.user_id, role=body.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {e}")
