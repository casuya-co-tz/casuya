"""Math/STEM endpoints — equation solving, unit conversion, problem generation."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.ai_service import (
    convert_units,
    generate_math_steps,
    generate_physics_problem,
    solve_equation,
)

router = APIRouter(prefix="/math", tags=["Math/STEM"])


class SolveRequest(BaseModel):
    formula: str
    variables: dict


class StepsRequest(BaseModel):
    expression: str
    target: str = ""


class ConvertRequest(BaseModel):
    value: float
    from_unit: str
    to_unit: str


class PhysicsProblemRequest(BaseModel):
    topic: str
    difficulty: str = "medium"


@router.post("/solve")
async def api_solve(req: SolveRequest):
    result = await solve_equation(req.formula, req.variables)
    return result


@router.post("/steps")
async def api_steps(req: StepsRequest):
    steps = await generate_math_steps(req.expression, req.target)
    return {"steps": steps}


@router.post("/convert")
async def api_convert(req: ConvertRequest):
    result = await convert_units(req.value, req.from_unit, req.to_unit)
    return result


@router.post("/physics-problem")
async def api_physics_problem(req: PhysicsProblemRequest):
    result = await generate_physics_problem(req.topic, req.difficulty)
    return result
