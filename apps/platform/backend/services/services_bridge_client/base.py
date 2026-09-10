from __future__ import annotations

import httpx

from backend.config.settings import get_settings

from .analytics import AnalyticsMixin
from .auth import AuthMixin
from .content import ContentMixin
from .exams import ExamsMixin
from .media import MediaMixin
from .search import SearchMixin


class ServicesBridgeClient(ContentMixin, ExamsMixin, MediaMixin, AuthMixin, AnalyticsMixin, SearchMixin):
    """HTTP client for the casuya-services-bridge microservice."""

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.casuya_services_bridge_url.rstrip("/")
        self.http = httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(connect=2.0, read=8.0, write=8.0, pool=2.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

    def _request(self, method: str, path: str, *, params=None, json=None) -> dict | list:
        try:
            resp = self.http.request(method, path, params=params, json=json)
            resp.raise_for_status()
            return resp.json()
        except httpx.ConnectError:
            raise ConnectionError(f"casuya-services-bridge unavailable at {self.base_url}")
        except httpx.TimeoutException:
            raise ConnectionError(f"casuya-services-bridge timeout at {self.base_url}")

    def close(self):
        self.http.close()


_client: ServicesBridgeClient | None = None


def get_services_bridge_client() -> ServicesBridgeClient:
    """Return a shared ServicesBridgeClient instance (reuses TCP connections)."""
    global _client
    if _client is None:
        _client = ServicesBridgeClient()
    return _client