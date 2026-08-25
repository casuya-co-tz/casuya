import html
import json
import re

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


def sanitize_html(value: str) -> str:
    return html.escape(value, quote=True)


def sanitize_input(value: str) -> str:
    value = html.escape(value, quote=True)
    value = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", value)
    return value.strip()


def sanitize_dict(data: dict) -> dict:
    result = {}
    for key, value in data.items():
        if isinstance(value, str):
            result[key] = sanitize_input(value)
        elif isinstance(value, dict):
            result[key] = sanitize_dict(value)
        elif isinstance(value, list):
            result[key] = [
                sanitize_dict(v) if isinstance(v, dict) else sanitize_input(v) if isinstance(v, str) else v
                for v in value
            ]
        else:
            result[key] = value
    return result


class InputSanitizerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in {"POST", "PUT", "PATCH"}:
            try:
                body = await request.json()
            except Exception:
                return await call_next(request)
            sanitized = sanitize_dict(body)
            request._body = json.dumps(sanitized).encode()
        return await call_next(request)
