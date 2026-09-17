"""AI bridge — HTTP client for the casuya-ai microservice."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid

import httpx

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {429, 502, 503, 504}
_MAX_RETRIES = 2
_RETRY_BACKOFF_S = 0.4
_BREAKER_FAILURE_THRESHOLD = 3
_BREAKER_OPEN_SECONDS = 30.0

# Reuse a single async httpx client for connection pooling (P2-9)
_http_client: httpx.AsyncClient | None = None
_breaker_failures = 0
_breaker_open_until = 0.0


class AiServiceError(Exception):
    """Raised when casuya-ai is unreachable or returns an error response."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        endpoint: str = "",
        body: dict | str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.endpoint = endpoint
        self.body = body


def get_casuya_ai_url() -> str:
    """Resolve AI base URL from settings (avoids import-time env drift)."""
    from backend.config.settings import get_settings

    return (get_settings().casuya_ai_url or "").rstrip("/")


def _circuit_open() -> bool:
    return time.monotonic() < _breaker_open_until


def _record_success() -> None:
    global _breaker_failures, _breaker_open_until
    _breaker_failures = 0
    _breaker_open_until = 0.0


def _record_failure() -> None:
    global _breaker_failures, _breaker_open_until
    _breaker_failures += 1
    if _breaker_failures >= _BREAKER_FAILURE_THRESHOLD:
        _breaker_open_until = time.monotonic() + _BREAKER_OPEN_SECONDS
        logger.warning(
            "casuya-ai circuit breaker OPEN for %.0fs after %d failures",
            _BREAKER_OPEN_SECONDS,
            _breaker_failures,
        )


def reset_ai_circuit_breaker() -> None:
    """Test helper — reset circuit breaker state."""
    global _breaker_failures, _breaker_open_until
    _breaker_failures = 0
    _breaker_open_until = 0.0


async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client


def _parse_error_body(resp: httpx.Response) -> dict | str | None:
    try:
        return resp.json()
    except Exception:
        text = (resp.text or "").strip()
        return text[:500] if text else None


def _log_ai_call(
    *,
    endpoint: str,
    request_id: str,
    latency_ms: float,
    ok: bool,
    status_code: int | None = None,
    error: str | None = None,
) -> None:
    payload = {
        "endpoint": endpoint,
        "request_id": request_id,
        "latency_ms": round(latency_ms, 1),
        "ok": ok,
    }
    if status_code is not None:
        payload["status_code"] = status_code
    if error:
        payload["error"] = error[:200]
    logger.info("casuya_ai_call %s", payload)


async def _call_ai_service(endpoint: str, payload: dict) -> dict:
    """Call casuya-ai and return JSON. Raises AiServiceError on failure."""
    from backend.config.settings import get_settings

    if _circuit_open():
        raise AiServiceError(
            "casuya-ai circuit breaker open — skipping call",
            status_code=503,
            endpoint=endpoint,
        )

    base_url = get_casuya_ai_url()
    if not base_url:
        raise AiServiceError("CASUYA_AI_URL is not configured", endpoint=endpoint)

    settings = get_settings()
    request_id = uuid.uuid4().hex[:16]
    headers: dict[str, str] = {"X-Request-Id": request_id}
    if settings.casuya_ai_api_key:
        headers["X-API-Key"] = settings.casuya_ai_api_key

    url = f"{base_url}{endpoint}"
    last_exc: Exception | None = None
    started = time.perf_counter()

    for attempt in range(_MAX_RETRIES + 1):
        try:
            client = await _get_http_client()
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                body = _parse_error_body(resp)
                if resp.status_code in _RETRYABLE_STATUS and attempt < _MAX_RETRIES:
                    await asyncio.sleep(_RETRY_BACKOFF_S * (attempt + 1))
                    continue
                detail = body.get("error") if isinstance(body, dict) else body
                _record_failure()
                _log_ai_call(
                    endpoint=endpoint,
                    request_id=request_id,
                    latency_ms=(time.perf_counter() - started) * 1000,
                    ok=False,
                    status_code=resp.status_code,
                    error=str(detail) if detail else None,
                )
                raise AiServiceError(
                    f"casuya-ai {endpoint} failed: HTTP {resp.status_code}"
                    + (f" — {detail}" if detail else ""),
                    status_code=resp.status_code,
                    endpoint=endpoint,
                    body=body,
                )
            data = resp.json()
            if not isinstance(data, dict):
                _record_failure()
                raise AiServiceError(
                    f"casuya-ai {endpoint} returned non-object JSON",
                    endpoint=endpoint,
                )
            _record_success()
            _log_ai_call(
                endpoint=endpoint,
                request_id=request_id,
                latency_ms=(time.perf_counter() - started) * 1000,
                ok=True,
                status_code=resp.status_code,
            )
            return data
        except AiServiceError:
            raise
        except Exception as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(_RETRY_BACKOFF_S * (attempt + 1))
                continue
            _record_failure()
            _log_ai_call(
                endpoint=endpoint,
                request_id=request_id,
                latency_ms=(time.perf_counter() - started) * 1000,
                ok=False,
                error=str(exc),
            )
            raise AiServiceError(
                f"casuya-ai unavailable at {base_url}{endpoint}: {exc}",
                endpoint=endpoint,
            ) from exc

    _record_failure()
    raise AiServiceError(
        f"casuya-ai unavailable at {base_url}{endpoint}: {last_exc}",
        endpoint=endpoint,
    ) from last_exc
