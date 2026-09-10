"""Services Bridge — auth package routes."""

from __future__ import annotations

from fastapi import APIRouter, Query

from backend.api.services_bridge.common import _bridge, _guard

router = APIRouter(tags=["services-bridge"])


@router.post("/auth/register")
@router.post("/auth/register/")
def bridge_register(payload: dict):
    return _guard(lambda: _bridge.register_user(payload))


@router.post("/auth/login")
@router.post("/auth/login/")
def bridge_login(payload: dict):
    return _guard(lambda: _bridge.login(payload.get("email", ""), payload.get("password", "")))


@router.post("/auth/verify")
@router.post("/auth/verify/")
def bridge_verify(token: str = Query(...)):
    return _guard(lambda: _bridge.verify_token(token))


@router.post("/auth/permission")
@router.post("/auth/permission/")
def bridge_permission(payload: dict):
    return _guard(lambda: _bridge.check_permission(payload))


@router.get("/auth/roles/{user_id}")
@router.get("/auth/roles/{user_id}/")
def bridge_roles(user_id: str):
    return _guard(lambda: _bridge.get_user_roles(user_id))


@router.post("/auth/policy")
@router.post("/auth/policy/")
def bridge_policy(payload: dict):
    return _guard(lambda: _bridge.create_policy(payload))