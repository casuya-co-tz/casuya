"""AI bridge — math / STEM solving, unit conversion and physics problems."""

from __future__ import annotations

import ast
import math
import operator

from .client import _call_ai_service


_SAFE_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.BitXor: operator.xor,
    ast.BitAnd: operator.and_,
    ast.BitOr: operator.or_,
    ast.LShift: operator.lshift,
    ast.RShift: operator.rshift,
}

_SAFE_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
    ast.Not: operator.not_,
    ast.Invert: operator.invert,
}

_SAFE_CONSTS = {"e": math.e, "pi": math.pi, "tau": math.tau}


def _safe_eval(expr: str, context: dict) -> float:
    """Evaluate an arithmetic expression safely using only an AST whitelist.

    No arbitrary code execution: only numbers, arithmetic operators, and a
    small set of whitelisted names/functions are permitted. Anything else
    raises ValueError.
    """
    node = ast.parse(expr, mode="eval").body
    names = {k: v for k, v in _SAFE_CONSTS.items()}
    names.update(context)

    _allowed_fns = {
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "asin": math.asin,
        "acos": math.acos,
        "atan": math.atan,
        "sqrt": math.sqrt,
        "log": math.log,
        "log10": math.log10,
        "exp": math.exp,
        "abs": abs,
        "floor": math.floor,
        "ceil": math.ceil,
        "min": min,
        "max": max,
        "pow": math.pow,
        "round": round,
    }

    def eval_node(n: ast.AST):
        if isinstance(n, ast.Expression):
            return eval_node(n.body)
        if isinstance(n, ast.Constant):
            if isinstance(n.value, (int, float, bool)) or n.value is None:
                return n.value
            raise ValueError("Unsupported constant")
        if isinstance(n, ast.Name):
            if n.id in names:
                return names[n.id]
            raise ValueError(f"Unknown name: {n.id}")
        if isinstance(n, ast.BinOp):
            op = _SAFE_BIN_OPS.get(type(n.op))
            if op is None:
                raise ValueError("Unsupported binary operator")
            return op(eval_node(n.left), eval_node(n.right))
        if isinstance(n, ast.UnaryOp):
            op = _SAFE_UNARY_OPS.get(type(n.op))
            if op is None:
                raise ValueError("Unsupported unary operator")
            return op(eval_node(n.operand))
        if isinstance(n, ast.BoolOp):
            if isinstance(n.op, ast.And):
                return all(eval_node(v) for v in n.values)
            if isinstance(n.op, ast.Or):
                return any(eval_node(v) for v in n.values)
        if isinstance(n, ast.Call):
            if not isinstance(n.func, ast.Name):
                raise ValueError("Unsupported function call")
            fn = _allowed_fns.get(n.func.id)
            if fn is None:
                raise ValueError(f"Unknown function: {n.func.id}")
            args = [eval_node(a) for a in n.args]
            if n.keywords:
                raise ValueError("Keyword arguments not allowed")
            return fn(*args)
        if isinstance(n, ast.Compare):
            # Support a single comparison for simple boolean results.
            if len(n.ops) == 1 and len(n.comparators) == 1:
                op_map = {
                    ast.Lt: operator.lt,
                    ast.LtE: operator.le,
                    ast.Gt: operator.gt,
                    ast.GtE: operator.ge,
                    ast.Eq: operator.eq,
                    ast.NotEq: operator.ne,
                }
                op = op_map.get(type(n.ops[0]))
                if op is not None:
                    return op(eval_node(n.left), eval_node(n.comparators[0]))
            raise ValueError("Unsupported comparison")
        if isinstance(n, ast.IfExp):
            return eval_node(n.body) if eval_node(n.test) else eval_node(n.orelse)
        raise ValueError("Unsupported expression")

    result = eval_node(node)
    if not isinstance(result, (int, float)):
        raise ValueError("Expression is not numeric")
    return float(result)


async def solve_equation(formula: str, variables: dict) -> dict:
    """Solve a physics/math equation given variable values."""
    result = await _call_ai_service(
        "/api/math/solve",
        {
            "formula": formula,
            "variables": variables,
        },
    )
    if result:
        return result

    # Fallback: safe local evaluation (AST whitelist — no eval/exec of user input).
    try:
        expr = formula
        context: dict = {}
        for name, val in variables.items():
            if isinstance(val, dict) and "value" in val and val["value"] is not None:
                try:
                    context[name] = float(val["value"])
                except (TypeError, ValueError):
                    continue
            elif isinstance(val, (int, float)):
                context[name] = float(val)
        result_val = _safe_eval(expr, context)
        return {"result": result_val, "formula": formula}
    except Exception:
        return {"error": "Could not solve equation", "formula": formula}


async def generate_math_steps(expression: str, target: str = "") -> list[str]:
    """Generate step-by-step solution for a math problem."""
    result = await _call_ai_service(
        "/api/math/steps",
        {
            "expression": expression,
            "target": target,
        },
    )
    if result and "steps" in result:
        return result["steps"]

    return [f"Expression: {expression}", "Solve step by step..."]


async def convert_units(value: float, from_unit: str, to_unit: str) -> dict:
    """Convert between measurement units."""
    result = await _call_ai_service(
        "/api/math/convert",
        {
            "value": value,
            "from": from_unit,
            "to": to_unit,
        },
    )
    if result:
        return result

    # Fallback: common conversions
    conversions = {
        ("km", "mi"): 0.621371,
        ("mi", "km"): 1.60934,
        ("kg", "lb"): 2.20462,
        ("lb", "kg"): 0.453592,
        ("m", "ft"): 3.28084,
        ("ft", "m"): 0.3048,
        ("c", "f"): lambda c: c * 9 / 5 + 32,
        ("f", "c"): lambda f: (f - 32) * 5 / 9,
        ("l", "gal"): 0.264172,
        ("gal", "l"): 3.78541,
    }
    key = (from_unit.lower(), to_unit.lower())
    if key in conversions:
        factor = conversions[key]
        converted = factor(value) if callable(factor) else value * factor
        return {"value": value, "from": from_unit, "to": to_unit, "result": round(converted, 6)}

    return {"error": f"Unknown conversion: {from_unit} to {to_unit}", "value": value}


async def generate_physics_problem(topic: str, difficulty: str = "medium") -> dict:
    """Generate a physics practice problem."""
    result = await _call_ai_service(
        "/api/math/physics-problem",
        {
            "topic": topic,
            "difficulty": difficulty,
        },
    )
    if result:
        return result

    return {
        "topic": topic,
        "difficulty": difficulty,
        "problem": f"Practice problem on {topic} ({difficulty} level)",
        "hint": "Consider the relevant physical laws and equations.",
    }
