"""Payment plans — platform fees paid by students/teachers via AzamPay."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.config.database import get_db
from backend.models.payment_plan import PaymentPlan
from backend.services.payment_service.checkout import initiate_checkout


def create_plan(data, db: Session | None = None) -> dict:
    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        plan = PaymentPlan(
            name=data.name,
            description=data.description,
            amount_tzs=data.amount_tzs,
            currency=data.currency,
            audience=data.audience,
            is_active=data.is_active,
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return _plan_to_dict(plan)
    finally:
        if own:
            _gen.close()


def list_plans(role: str | None = None, include_inactive: bool = False, db: Session | None = None) -> list[dict]:
    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        q = db.query(PaymentPlan)
        if not include_inactive:
            q = q.filter(PaymentPlan.is_active.is_(True))
        plans = q.order_by(PaymentPlan.created_at.desc()).all()
        result = [_plan_to_dict(p) for p in plans]
        if role:
            result = [
                p
                for p in result
                if p["audience"] in ("both", role)
            ]
        return result
    finally:
        if own:
            _gen.close()


def get_plan(plan_id: str, db: Session | None = None):
    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        plan = db.query(PaymentPlan).filter(PaymentPlan.id == plan_id).first()
        return _plan_to_dict(plan) if plan else None
    finally:
        if own:
            _gen.close()


def update_plan(plan_id: str, data, db: Session | None = None) -> dict | None:
    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        plan = db.query(PaymentPlan).filter(PaymentPlan.id == plan_id).first()
        if not plan:
            return None
        for field in ("name", "description", "amount_tzs", "currency", "audience", "is_active"):
            value = getattr(data, field, None)
            if value is not None:
                setattr(plan, field, value)
        db.commit()
        db.refresh(plan)
        return _plan_to_dict(plan)
    finally:
        if own:
            _gen.close()


def delete_plan(plan_id: str, db: Session | None = None) -> bool:
    own = db is None
    if own:
        _gen = get_db()
        db = next(_gen)
    try:
        plan = db.query(PaymentPlan).filter(PaymentPlan.id == plan_id).first()
        if not plan:
            return False
        db.delete(plan)
        db.commit()
        return True
    finally:
        if own:
            _gen.close()


def pay_plan(plan_id: str, user_id: str, mobile_number: str, provider: str, idempotency_key: str | None = None) -> dict:
    """Initiate an AzamPay checkout for a specific plan, crediting the platform."""
    plan = get_plan(plan_id)
    if not plan:
        raise ValueError("Plan not found")
    if not plan["is_active"]:
        raise ValueError("Plan is not active")
    result = initiate_checkout(
        user_id=user_id,
        amount_tzs=plan["amount_tzs"],
        mobile_number=mobile_number,
        provider=provider,
        idempotency_key=idempotency_key,
        plan_id=plan["id"],
        plan_name=plan["name"],
    )
    return result


def _plan_to_dict(plan) -> dict:
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "amount_tzs": plan.amount_tzs,
        "currency": plan.currency,
        "audience": plan.audience,
        "is_active": plan.is_active,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }