from __future__ import annotations


class AnalyticsMixin:
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