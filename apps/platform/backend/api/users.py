from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.user import User
from backend.schemas.users import UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[dict], dependencies=[Depends(require_role("admin"))])
@router.get("/", response_model=list[dict], dependencies=[Depends(require_role("admin"))])
def list_users_route():
    _gen = get_db()
    db: Session = next(_gen)
    try:
        users = db.query(User).filter(User.is_active).all()
        return [
            {"id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone, "role": u.role} for u in users
        ]
    finally:
        _gen.close()


@router.get("/me", response_model=UserResponse)
@router.get("/me/", response_model=UserResponse)
def get_current_user_route(current_user=Depends(get_current_user)):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.id == current_user["sub"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
        )
    finally:
        _gen.close()


@router.patch("/me", response_model=UserResponse)
@router.patch("/me/", response_model=UserResponse)
def update_current_user_route(body: UserUpdateRequest, current_user=Depends(get_current_user)):
    _gen = get_db()
    db: Session = next(_gen)
    try:
        user = db.query(User).filter(User.id == current_user["sub"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if body.full_name is not None:
            user.full_name = body.full_name
        if body.phone is not None:
            user.phone = body.phone
        db.commit()
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            is_active=user.is_active,
        )
    finally:
        _gen.close()
