from __future__ import annotations


class ContentMixin:
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