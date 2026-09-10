from __future__ import annotations


class MediaMixin:
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