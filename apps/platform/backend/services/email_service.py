"""Transactional email via Brevo SMTP relay."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)


def _configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_user and settings.smtp_password)


def send_email(to: str, subject: str, body_html: str, body_text: str) -> bool:
    """Send a transactional email. Returns True on success, False on any failure.

    Fails open (logs + returns False) so auth flows never break when mail is down.
    """
    if not _configured():
        logger.warning("SMTP not configured; skipping email to %s", to)
        return False

    settings = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.email_from_name, settings.email_from))
    msg["To"] = to
    msg.set_content(body_text)
    msg.add_alternative(body_html, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception as e:  # noqa: BLE001 — mail must never break auth
        logger.error("Failed to send email to %s: %s", to, e)
        return False


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