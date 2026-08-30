"""Transactional email via Brevo (REST API preferred, SMTP relay fallback)."""

from __future__ import annotations

import logging
import re
import smtplib
import time
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)

_SMTP_TIMEOUT = 60
_SMTP_ATTEMPTS = 2
_SMTP_RETRY_DELAY = 2.0
_API_TIMEOUT = 30.0


def _configured() -> bool:
    settings = get_settings()
    return bool(settings.brevo_api_key or (settings.smtp_user and settings.smtp_password))


def smtp_configured() -> bool:
    """Public probe used by startup logging / health checks."""
    return _configured()


def _send_via_api(to: str, subject: str, body_html: str, body_text: str) -> bool:
    settings = get_settings()
    payload = {
        "sender": {"name": settings.email_from_name, "email": settings.email_from},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": body_html,
        "textContent": body_text,
    }
    try:
        resp = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": settings.brevo_api_key or "",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=payload,
            timeout=_API_TIMEOUT,
        )
        if resp.status_code in (200, 201, 202):
            return True
        logger.error("Brevo API send failed (HTTP %s): %s", resp.status_code, resp.text[:300])
        return False
    except Exception as e:  # noqa: BLE001 — mail must never break auth
        logger.error("Brevo API send error to %s: %s", to, e)
        return False


def _send_via_smtp(to: str, subject: str, body_html: str, body_text: str) -> bool:
    settings = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.email_from_name, settings.email_from))
    msg["To"] = to
    msg.set_content(body_text)
    msg.add_alternative(body_html, subtype="html")

    last_error: Exception | None = None
    for attempt in range(1, _SMTP_ATTEMPTS + 1):
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=_SMTP_TIMEOUT) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            return True
        except Exception as e:  # noqa: BLE001 — mail must never break auth
            last_error = e
            logger.warning("Email send attempt %d/%d to %s failed: %s", attempt, _SMTP_ATTEMPTS, to, e)
            if attempt < _SMTP_ATTEMPTS:
                time.sleep(_SMTP_RETRY_DELAY)
    logger.error("Failed to send email to %s: %s", to, last_error)
    return False


def send_email(to: str, subject: str, body_html: str, body_text: str) -> bool:
    """Send a transactional email. Returns True on success, False on any failure.

    Prefers the Brevo REST API (reliable from any cloud region) and falls back
    to the SMTP relay. Fails open (logs + returns False) so auth flows never
    break when mail is down.
    """
    if not _configured():
        logger.warning("Mail not configured; skipping email to %s", to)
        return False

    settings = get_settings()
    if settings.brevo_api_key:
        return _send_via_api(to, subject, body_html, body_text)
    return _send_via_smtp(to, subject, body_html, body_text)


def send_password_reset_email(to: str, reset_token: str) -> bool:
    settings = get_settings()
    reset_url = f"{settings.frontend_reset_url.rstrip('/')}?token={reset_token}"
    subject = "Reset your Casuya password"
    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Casuya — Password reset</h2>
        <p>Hi,</p>
        <p>We received a request to reset your password. Tap the button below to choose a new one:</p>
        <p>
          <a href="{reset_url}"
             style="display:inline-block; padding:12px 24px; background:#1D4ED8; color:#fff;
                    text-decoration:none; border-radius:6px;">
            Reset password
          </a>
        </p>
        <p>If the button does not work, copy this link into your browser:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      </body>
    </html>
    """
    body_text = (
        "Casuya — Password reset\n\n"
        "We received a request to reset your password. Open this link to choose a new one:\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    return send_email(to, subject, body_html, body_text)


# ---------- Brevo Transactional SMS ----------


def _normalize_sms_phone(phone: str) -> str:
    """Normalize a phone number to E.164 for Brevo SMS (Tanzanian default +255).

    Accepts '+2557XXXXXXXX', '2557XXXXXXXX', '07XXXXXXXX' and bare '7XXXXXXXX',
    and returns the canonical E.164 form with a leading '+'.
    """
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("0"):
        digits = "255" + digits[1:]
    elif len(digits) == 9:
        digits = "255" + digits
    if not digits.startswith("255"):
        digits = "255" + digits
    return "+" + digits


def _sms_configured() -> bool:
    return bool(get_settings().brevo_api_key)


def _send_sms_via_brevo(phone: str, content: str) -> bool:
    """Send a transactional SMS through the Brevo API using the shared API key."""
    settings = get_settings()
    if not settings.brevo_api_key:
        logger.warning("Brevo SMS not configured (no brevo_api_key); skipping SMS to %s", phone)
        return False
    payload = {
        "type": "transactional",
        "sender": settings.brevo_sms_sender or "CASUYA",
        "recipient": _normalize_sms_phone(phone),
        "content": content,
        "unicodeEnabled": True,
    }
    try:
        resp = httpx.post(
            "https://api.brevo.com/v3/transactionalSMS/sms",
            headers={
                "api-key": settings.brevo_api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=payload,
            timeout=_API_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            return True
        logger.error("Brevo SMS send failed (HTTP %s): %s", resp.status_code, resp.text[:300])
        return False
    except Exception as e:  # noqa: BLE001 — SMS must never break auth
        logger.error("Brevo SMS send error to %s: %s", phone, e)
        return False


def send_password_reset_sms(phone: str, reset_token: str) -> bool:
    """Deliver a password reset link/code to the user's phone via Brevo SMS."""
    settings = get_settings()
    reset_url = f"{settings.frontend_reset_sms_url.rstrip('/')}?token={reset_token}"
    content = (
        "Casuya: To reset your password, open this link:\n"
        f"{reset_url}\n\n"
        "If you did not request this, ignore this message."
    )
    return _send_sms_via_brevo(phone, content)