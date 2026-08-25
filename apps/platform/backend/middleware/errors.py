import re

from fastapi import Request
from fastapi.responses import JSONResponse

from backend.config.settings import get_settings


def _is_allowed_origin(origin: str) -> bool:
    settings = get_settings()
    if "*" in settings.allowed_origins:
        return True
    if origin in settings.allowed_origins:
        return True
    if settings.cors_origin_regex:
        pattern = re.compile(settings.cors_origin_regex)
        if pattern.fullmatch(origin):
            return True
    return False


def _add_cors_headers(response: JSONResponse, request: Request) -> JSONResponse:
    origin = request.headers.get("origin")
    if origin and _is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


async def unhandled_exception_handler(request: Request, exc: Exception):
    response = JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "detail": "An unexpected error occurred"},
    )
    return _add_cors_headers(response, request)


async def http_exception_handler(request: Request, exc):
    response = JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "detail": exc.detail},
    )
    return _add_cors_headers(response, request)


def register_error_handlers(app):
    from fastapi.exceptions import HTTPException

    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
