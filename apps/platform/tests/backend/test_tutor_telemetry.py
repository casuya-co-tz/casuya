from backend.services.ai_bridge.tutor_telemetry import record_tutor_event, tutor_telemetry_snapshot


def test_tutor_telemetry_records_and_snapshots():
    record_tutor_event(
        path="/ai/tutoring/stream",
        source="casuya-ai",
        format_level="complete",
        needs_review=False,
        provider_tier="fast",
    )
    snap = tutor_telemetry_snapshot()
    assert snap["counters"]["requests"] >= 1
    assert snap["counters"]["stream"] >= 1
    assert "rates" in snap
    assert isinstance(snap["samples"], list)
