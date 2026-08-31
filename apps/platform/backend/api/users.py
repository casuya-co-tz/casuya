from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.middleware.auth import get_current_user
from backend.middleware.permissions import require_role
from backend.models.user import User
from backend.schemas.users import UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=dict, dependencies=[Depends(require_role("admin"))])
@router.get("/", response_model=dict, dependencies=[Depends(require_role("admin"))])
def list_users_route(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    total = db.query(User).filter(User.is_active).count()
    users = db.query(User).filter(User.is_active).offset(offset).limit(limit).all()
    return {
        "items": [
            {"id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone, "role": u.role}
            for u in users
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/me", response_model=UserResponse)
@router.get("/me/", response_model=UserResponse)
def get_current_user_route(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
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


@router.patch("/me", response_model=UserResponse)
@router.patch("/me/", response_model=UserResponse)
def update_current_user_route(body: UserUpdateRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
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
