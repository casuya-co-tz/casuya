"""Isolated event-analytics engine (separate Neon cluster).

The analytics cluster intentionally shares NOTHING with the primary
operational database — its own schema, its own connection pool, its own
lifetime. Every entry point in this module degrades to a no-op when
``ANALYTICS_DATABASE_URL`` is unset, so the platform keeps serving even if
the analytics cluster is unreachable or not yet provisioned.
"""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, text

from .settings import get_settings

logger = logging.getLogger(__name__)

# Neon's serverless allowance is small; keep this pool tiny (this store only
# ever receives high-frequency anonymous event writes + light extraction).
POOL_SIZE = 3
POOL_MAX_OVERFLOW = 5
POOL_RECYCLE = 300  # Neon recycles idle backends ~5 min
POOL_TIMEOUT = 5

_engine = None


def get_analytics_engine():
    """Return the analytics SQLAlchemy engine, or None if not configured."""
    global _engine
    if _engine is None:
        settings = get_settings()
        if settings.analytics_database_url:
            _engine = create_engine(
                settings.analytics_database_url,
                pool_size=POOL_SIZE,
                max_overflow=POOL_MAX_OVERFLOW,
                pool_pre_ping=True,
                pool_recycle=POOL_RECYCLE,
                pool_timeout=POOL_TIMEOUT,
            )
    return _engine


def analytics_available() -> bool:
    return get_analytics_engine() is not None


# ─── Schema (Phase 1 of the blueprint) ──────────────────────────────────────

_DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS raw_event_stream (
        event_id BIGSERIAL PRIMARY KEY,
        visitor_hash VARCHAR(64) NOT NULL,
        route_path VARCHAR(255) NOT NULL,
        interaction_type VARCHAR(50) NOT NULL,
        scroll_depth INT DEFAULT 0,
        active_duration INT DEFAULT 0,
        device_profile VARCHAR(30),
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_perf_stream
    ON raw_event_stream (interaction_type, route_path, recorded_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS daily_metric_snapshots (
        snapshot_id SERIAL PRIMARY KEY,
        logged_date DATE NOT NULL,
        route_path VARCHAR(255) NOT NULL,
        aggregated_hits INT,
        median_scroll INT,
        successful_logins INT,
        UNIQUE (logged_date, route_path)
    )
    """,
    # (Blueprint declared logged_date DATE UNIQUE; per-route rows are valid so
    # the real key is (logged_date, route_path).) The daily job runs below.
    """
    CREATE OR REPLACE PROCEDURE execute_data_retention_compress() AS $$
    BEGIN
        INSERT INTO daily_metric_snapshots
            (logged_date, route_path, aggregated_hits, median_scroll, successful_logins)
        SELECT CURRENT_DATE - 1,
               route_path,
               COUNT(*),
               ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY scroll_depth))::INT,
               COUNT(*) FILTER (WHERE interaction_type = 'login_success_action')
        FROM raw_event_stream
        WHERE recorded_at::date = CURRENT_DATE - 1
        GROUP BY route_path
        ON CONFLICT (logged_date, route_path) DO UPDATE SET
            aggregated_hits = EXCLUDED.aggregated_hits,
            median_scroll = EXCLUDED.median_scroll,
            successful_logins = EXCLUDED.successful_logins;
        DELETE FROM raw_event_stream WHERE recorded_at < NOW() - INTERVAL '60 DAYS';
    END;
    $$ LANGUAGE plpgsql;
    """,
]


def init_analytics_db() -> None:
    """Create the analytics schema + retention procedure (idempotent).

    Runs each statement in its own savepoint so a failure cannot abort the
    remaining DDL. No-op (with a warning) when the analytics cluster is not
    configured — the main app must never fail to boot over analytics.
    """
    engine = get_analytics_engine()
    if engine is None:
        logger.info("analytics cluster not configured; skipping analytics schema")
        return
    try:
        with engine.begin() as conn:
            for stmt in _DDL_STATEMENTS:
                with conn.begin_nested():
                    conn.execute(text(stmt))
        logger.info("analytics schema ready")
    except Exception as exc:  # noqa: BLE001
        logger.warning("analytics schema init failed, continuing: %s", exc)


# ─── Writes (Phase 3 core) ──────────────────────────────────────────────────

_INSERT = """
INSERT INTO raw_event_stream
    (visitor_hash, route_path, interaction_type, scroll_depth, active_duration, device_profile)
VALUES
    (:visitor_hash, :route_path, :interaction_type, :scroll_depth, :active_duration, :device_profile)
"""


def insert_event(row: dict) -> None:
    """Write a single normalized event row to the analytics cluster."""
    engine = get_analytics_engine()
    if engine is None:
        return
    with engine.begin() as conn:
        conn.execute(text(_INSERT), row)


# ─── Retention (Phase 6) ────────────────────────────────────────────────────

def run_retention_compress() -> dict:
    """Compress yesterday into daily_metric_snapshots, purge rows older than 60 days.

    Mirrors ``execute_data_retention_compress()`` so the scheduled in-process
    job depends on SQLAlchemy only (PgBouncer-friendly), while the stored
    procedure remains available for manual/BYO runs.
    """
    engine = get_analytics_engine()
    if engine is None:
        return {"available": False}
    with engine.begin() as conn:
        compressed = conn.execute(
            text(
                """
                INSERT INTO daily_metric_snapshots
                    (logged_date, route_path, aggregated_hits, median_scroll, successful_logins)
                SELECT CURRENT_DATE - 1,
                       route_path,
                       COUNT(*),
                       ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY scroll_depth))::INT,
                       COUNT(*) FILTER (WHERE interaction_type = 'login_success_action')
                FROM raw_event_stream
                WHERE recorded_at::date = CURRENT_DATE - 1
                GROUP BY route_path
                ON CONFLICT (logged_date, route_path) DO UPDATE SET
                    aggregated_hits = EXCLUDED.aggregated_hits,
                    median_scroll = EXCLUDED.median_scroll,
                    successful_logins = EXCLUDED.successful_logins
                """
            )
        ).rowcount
        purged = conn.execute(
            text("DELETE FROM raw_event_stream WHERE recorded_at < NOW() - INTERVAL '60 DAYS'")
        ).rowcount
    return {"compressed_rows": compressed, "purged_rows": purged}


# ─── Wirehouse extraction (Phase 5) ─────────────────────────────────────────

_TOP_ROUTES_SQL = """
SELECT route_path,
       COUNT(*) AS total_page_hits,
       ROUND(AVG(scroll_depth)::numeric, 1) AS mean_scroll_percentage,
       ROUND(AVG(active_duration)) AS mean_reading_seconds
FROM raw_event_stream
WHERE interaction_type = 'page_exit_metric'
GROUP BY route_path
ORDER BY total_page_hits DESC
LIMIT :limit
"""

_LOGINS_24H_SQL = """
SELECT COUNT(*) AS successful_logins_count
FROM raw_event_stream
WHERE interaction_type = 'login_success_action'
  AND recorded_at >= NOW() - INTERVAL '24 HOURS'
"""


def get_summary(limit: int = 15) -> dict:
    """Run the Phase-5 extraction matrices against the analytics cluster."""
    engine = get_analytics_engine()
    if engine is None:
        return {"available": False, "top_routes": [], "successful_logins_24h": 0}
    with engine.connect() as conn:
        top = conn.execute(text(_TOP_ROUTES_SQL), {"limit": limit}).mappings().all()
        logins = conn.execute(text(_LOGINS_24H_SQL)).scalar() or 0
    return {
        "available": True,
        "top_routes": [dict(row) for row in top],
        "successful_logins_24h": int(logins),
    }
