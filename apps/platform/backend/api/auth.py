from fastapi import APIRouter, Depends, HTTPException, Request

from backend.middleware.auth import get_current_user
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
def login(body: LoginRequest, request: Request):
    try:
        result = authenticate_user(
            email=body.email, password=body.password, keep_logged_in=body.keep_logged_in
        )
        # Fire the analytics login_success_action signal inside the success
        # block only (blueprint Phase 4) — never on denial.
        try:
            from backend.services import analytics_events

            forwarded = request.headers.get("x-forwarded-for")
            ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")
            analytics_events.enqueue_event(
                route_path="/login",
                interaction_type="login_success_action",
                ip=ip,
                user_agent=request.headers.get("user-agent", ""),
            )
        except Exception:  # noqa: BLE001 — analytics must never affect login
            pass
        return result
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
def complete_registration_endpoint(
    body: CompleteRegistrationRequest,
    current_user: dict = Depends(get_current_user),
):
    # Verify the caller is completing their own registration
    if current_user.get("sub") != body.user_id:
        raise HTTPException(status_code=403, detail="Cannot complete registration for another user")
    # Only pending users should use this endpoint
    if current_user.get("role") not in ("pending", None):
        raise HTTPException(status_code=400, detail="Registration already completed")
    try:
        return complete_registration(user_id=body.user_id, role=body.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {e}")
