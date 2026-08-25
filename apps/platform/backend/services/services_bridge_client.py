"""Casuya Services Bridge client.

Thin typed HTTP client for the casuya-services-bridge microservice which hosts
the content, exams, media, auth, analytics and search packages over HTTP.

Raises ConnectionError when the bridge is unreachable so callers can fall back
to local behaviour.
"""

from __future__ import annotations

import httpx

from backend.config.settings import get_settings


class ServicesBridgeClient:
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

    # ─── Content ───────────────────────────────────────────────────────────
    def create_content(self, payload: dict) -> dict:
        return self._request("POST", "/content", json=payload)

    def get_content(self, content_id: str) -> dict:
        return self._request("GET", f"/content/{content_id}")

    def get_content_by_slug(self, slug: str) -> dict:
        return self._request("GET", f"/content/slug/{slug}")

    def list_content(self, params: dict | None = None) -> dict:
        return self._request("GET", "/content", params=params or {})

    def update_content(self, content_id: str, payload: dict) -> dict:
        return self._request("PUT", f"/content/{content_id}", json=payload)

    def delete_content(self, content_id: str) -> dict:
        return self._request("DELETE", f"/content/{content_id}")

    def create_category(self, payload: dict) -> dict:
        return self._request("POST", "/content/categories", json=payload)

    def list_categories(self) -> list:
        return self._request("GET", "/content/categories")

    def get_category(self, category_id: str) -> dict:
        return self._request("GET", f"/content/categories/{category_id}")

    def get_category_children(self, category_id: str) -> list:
        return self._request("GET", f"/content/categories/{category_id}/children")

    def get_category_descendants(self, category_id: str) -> list:
        return self._request("GET", f"/content/categories/{category_id}/descendants")

    def delete_category(self, category_id: str) -> dict:
        return self._request("DELETE", f"/content/categories/{category_id}")

    def create_tag(self, payload: dict) -> dict:
        return self._request("POST", "/content/tags", json=payload)

    def list_tags(self, params: dict | None = None) -> dict:
        return self._request("GET", "/content/tags", params=params or {})

    def popular_tags(self) -> list:
        return self._request("GET", "/content/tags/popular")

    def publish_content(self, content_id: str, published_by: str, notes: str | None = None) -> dict:
        return self._request(
            "POST", f"/content/publish/{content_id}", json={"publishedBy": published_by, "notes": notes}
        )

    def unpublish_content(self, content_id: str, notes: str | None = None) -> dict:
        return self._request("POST", f"/content/unpublish/{content_id}", json={"notes": notes})

    def publishing_state(self, content_id: str) -> dict:
        return self._request("GET", f"/content/publish/{content_id}/state")

    def search_content(self, payload: dict) -> dict:
        return self._request("POST", "/content/search", json=payload)

    # ─── Exams ─────────────────────────────────────────────────────────────
    def create_question(self, payload: dict) -> dict:
        return self._request("POST", "/exams/questions", json=payload)

    def get_question(self, question_id: str) -> dict:
        return self._request("GET", f"/exams/questions/{question_id}")

    def list_questions(self) -> list:
        return self._request("GET", "/exams/questions")

    def update_question(self, question_id: str, payload: dict) -> dict:
        return self._request("PUT", f"/exams/questions/{question_id}", json=payload)

    def delete_question(self, question_id: str) -> dict:
        return self._request("DELETE", f"/exams/questions/{question_id}")

    def filter_questions(self, payload: dict) -> dict:
        return self._request("POST", "/exams/questions/filter", json=payload)

    def create_exam_category(self, payload: dict) -> dict:
        return self._request("POST", "/exams/categories", json=payload)

    def list_exam_categories(self) -> list:
        return self._request("GET", "/exams/categories")

    def create_exam_tag(self, payload: dict) -> dict:
        return self._request("POST", "/exams/tags", json=payload)

    def list_exam_tags(self) -> list:
        return self._request("GET", "/exams/tags")

    def create_exam(self, payload: dict) -> dict:
        return self._request("POST", "/exams", json=payload)

    def get_exam(self, exam_id: str) -> dict:
        return self._request("GET", f"/exams/{exam_id}")

    def list_exams(self) -> list:
        return self._request("GET", "/exams")

    def publish_exam(self, exam_id: str) -> dict:
        return self._request("POST", f"/exams/{exam_id}/publish")

    def add_exam_section(self, exam_id: str, payload: dict) -> dict:
        return self._request("POST", f"/exams/{exam_id}/section", json=payload)

    def autofill_section(self, exam_id: str, section_id: str, criteria: dict | None = None) -> dict:
        return self._request(
            "POST", f"/exams/{exam_id}/autofill", json={"sectionId": section_id, "criteria": criteria or {}}
        )

    def schedule_exam(self, payload: dict) -> dict:
        return self._request("POST", "/exams/schedule", json=payload)

    def upcoming_exams(self, limit: int | None = None) -> list:
        return self._request("GET", "/exams/schedule/upcoming", params={"limit": limit} if limit else {})

    def start_session(self, payload: dict) -> dict:
        return self._request("POST", "/exams/sessions", json=payload)

    def submit_answer(self, session_id: str, payload: dict) -> dict:
        return self._request("POST", f"/exams/sessions/{session_id}/submit", json=payload)

    def complete_session(self, session_id: str) -> dict:
        return self._request("POST", f"/exams/sessions/{session_id}/complete")

    def grade(self, payload: dict) -> dict:
        return self._request("POST", "/exams/grade", json=payload)

    def exam_report(self, action: str, payload: dict) -> dict:
        return self._request("POST", f"/exams/reports/{action}", json=payload)

    def generate_certificate(self, payload: dict) -> dict:
        return self._request("POST", "/exams/certificates", json=payload)

    def verify_certificate(self, verification_code: str) -> dict:
        return self._request("POST", "/exams/certificates/verify", json={"verificationCode": verification_code})

    def exam_analytics(self, exam_id: str) -> dict:
        return self._request("POST", "/exams/analytics", json={"examId": exam_id})

    def exam_security(self, action: str, payload: dict) -> dict:
        return self._request("POST", "/exams/security", json={"action": action, **payload})

    # ─── Media ─────────────────────────────────────────────────────────────
    def upload_media(self, payload: dict) -> dict:
        return self._request("POST", "/media/upload", json=payload)

    def get_media(self, media_id: str) -> dict:
        return self._request("GET", f"/media/{media_id}")

    def list_media(self, params: dict | None = None) -> dict:
        return self._request("GET", "/media", params=params or {})

    def delete_media(self, media_id: str) -> dict:
        return self._request("DELETE", f"/media/{media_id}")

    def deliver_media(self, media_id: str, params: dict | None = None) -> dict:
        return self._request("GET", f"/media/{media_id}/deliver", params=params or {})

    def media_thumbnail(self, media_id: str, payload: dict) -> dict:
        return self._request("POST", f"/media/{media_id}/thumbnail", json=payload)

    def media_stats(self) -> dict:
        return self._request("GET", "/media/stats")

    def search_media(self, payload: dict) -> dict:
        return self._request("POST", "/media/search", json=payload)

    # ─── Auth ──────────────────────────────────────────────────────────────
    def register_user(self, payload: dict) -> dict:
        return self._request("POST", "/auth/register", json=payload)

    def login(self, email: str, password: str) -> dict:
        return self._request("POST", "/auth/login", json={"email": email, "password": password})

    def verify_token(self, token: str) -> dict:
        return self._request("POST", "/auth/verify", json={"token": token})

    def refresh_token(self, refresh_token: str) -> dict:
        return self._request("POST", "/auth/refresh", json={"refreshToken": refresh_token})

    def hash_password(self, password: str) -> str:
        return self._request("POST", "/auth/hash", json={"password": password})

    def verify_password(self, password: str, password_hash: str) -> bool:
        return self._request("POST", "/auth/verify-password", json={"password": password, "hash": password_hash}).get(
            "valid", False
        )

    def check_permission(self, payload: dict) -> dict:
        return self._request("POST", "/auth/permission", json=payload)

    def get_user_roles(self, user_id: str) -> list:
        return self._request("GET", f"/auth/roles/{user_id}")

    def create_policy(self, payload: dict) -> dict:
        return self._request("POST", "/auth/policy", json=payload)

    def evaluate_policy(self, payload: dict) -> dict:
        return self._request("POST", "/auth/policy/evaluate", json=payload)

    def setup_mfa(self, user_id: str, method: str) -> dict:
        return self._request("POST", "/auth/mfa/setup", json={"userId": user_id, "method": method})

    def audit(self, payload: dict) -> dict:
        return self._request("POST", "/auth/audit", json=payload)

    # ─── Analytics ────────────────────────────────────────────────────────
    def ingest_metric(self, metric: str, value: dict) -> dict:
        return self._request("POST", "/analytics/ingest", json={"metric": metric, "value": value})

    def aggregate(self, payload: dict) -> dict:
        return self._request("POST", "/analytics/aggregate", json=payload)

    def emit_event(self, event: str, data: dict) -> dict:
        return self._request("POST", "/analytics/event", json={"event": event, "data": data})

    def record_metric(self, value: dict) -> dict:
        return self._request("POST", "/analytics/metric", json={"value": value})

    def query_metric(self, payload: dict) -> dict:
        return self._request("POST", "/analytics/metric/query", json=payload)

    def predict(self, payload: dict) -> dict:
        return self._request("POST", "/analytics/predict", json=payload)

    def export_data(self, data: list, fmt: str = "json") -> str:
        return self._request("POST", "/analytics/export", json={"data": data, "format": fmt})

    def cache_set(self, key: str, value, ttl: int | None = None) -> dict:
        return self._request("POST", "/analytics/cache", json={"key": key, "value": value, "ttl": ttl})

    def cache_get(self, key: str):
        return self._request("POST", "/analytics/cache/get", json={"key": key})

    def add_retention_rule(self, payload: dict) -> dict:
        return self._request("POST", "/analytics/retention/rule", json=payload)

    def evaluate_retention(self) -> list:
        return self._request("POST", "/analytics/retention/evaluate")

    def build_report(self, payload: dict) -> dict:
        return self._request("POST", "/analytics/report", json=payload)

    def build_query(self, payload: dict) -> dict:
        return self._request("POST", "/analytics/query", json=payload)

    def analytics_stats(self) -> dict:
        return self._request("GET", "/analytics/stats")

    # ─── Search ────────────────────────────────────────────────────────────
    def index_document(self, payload: dict) -> dict:
        return self._request("POST", "/search/index", json=payload)

    def index_documents(self, documents: list) -> dict:
        return self._request("POST", "/search/index-batch", json={"documents": documents})

    def remove_document(self, doc_id: str) -> dict:
        return self._request("DELETE", f"/search/{doc_id}")

    def search(self, payload: dict) -> list:
        return self._request("POST", "/search/query", json=payload)

    def suggestions(self, query: str) -> list:
        return self._request("GET", "/search/suggestions", params={"q": query})

    def recommendations(self, user_id: str) -> list:
        return self._request("GET", f"/search/recommendations/{user_id}")

    def record_interaction(self, payload: dict) -> dict:
        return self._request("POST", "/search/interaction", json=payload)

    def search_stats(self) -> dict:
        return self._request("GET", "/search/stats")

    def search_trends(self, days: int | None = None) -> dict:
        return self._request("GET", "/search/trends", params={"days": days} if days else {})

    def close(self):
        self.http.close()


_client: ServicesBridgeClient | None = None


def get_services_bridge_client() -> ServicesBridgeClient:
    """Return a shared ServicesBridgeClient instance (reuses TCP connections)."""
    global _client
    if _client is None:
        _client = ServicesBridgeClient()
    return _client
