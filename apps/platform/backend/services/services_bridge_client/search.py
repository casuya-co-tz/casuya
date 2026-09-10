from __future__ import annotations


class SearchMixin:
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