"""Integration adapter tests (no external calls — just structure/error checks)."""

import pytest

from backend.config.settings import get_settings


def test_casuya_core_no_key():
    from integrations.casuya_core import package_lesson
    settings = get_settings()
    original = settings.casuya_core_signing_key
    settings.casuya_core_signing_key = None
    with pytest.raises(RuntimeError, match="CASUYA_CORE_SIGNING_KEY"):
        package_lesson("<html/>", sign=True)
    settings.casuya_core_signing_key = original


def test_casuya_core_unsigned():
    from integrations.casuya_core import package_lesson
    result = package_lesson("<html/>", sign=False)
    assert "content_hash" in result
    assert "package_version" in result
    assert result["package_version"] == "1.0.0"


def test_bridge_no_key():
    from integrations.casuya_bridge import verify_bridge_payload
    settings = get_settings()
    original = settings.casuya_bridge_shared_key
    settings.casuya_bridge_shared_key = None
    with pytest.raises(RuntimeError, match="CASUYA_BRIDGE_SHARED_KEY"):
        verify_bridge_payload({"a": 1}, "sig")
    settings.casuya_bridge_shared_key = original


def test_azampay_no_creds():
    from integrations.azampay import mobile_checkout
    settings = get_settings()
    original_id = settings.azampay_client_id
    original_secret = settings.azampay_client_secret
    settings.azampay_client_id = None
    settings.azampay_client_secret = None
    with pytest.raises(RuntimeError, match="AzamPay"):
        mobile_checkout(1000, "255700000000", "Airtel", "ext-1")
    settings.azampay_client_id = original_id
    settings.azampay_client_secret = original_secret


def test_africastalking_no_creds():
    from integrations.africastalking import send_sms
    settings = get_settings()
    original_u = settings.africastalking_username
    original_k = settings.africastalking_api_key
    settings.africastalking_username = None
    settings.africastalking_api_key = None
    with pytest.raises(RuntimeError, match="Africa's Talking"):
        send_sms("255700000000", "Hello")
    settings.africastalking_username = original_u
    settings.africastalking_api_key = original_k


def test_supabase_no_config():
    from integrations.supabase import get_supabase_client
    assert get_supabase_client() is None


def test_runtime_manifest_no_lesson():
    from integrations.casuya_runtime import get_runtime_manifest
    with pytest.raises(ValueError, match="Lesson not found"):
        get_runtime_manifest("nonexistent-lesson-id")
