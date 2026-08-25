"""Application-wide logging configuration."""

from __future__ import annotations

import logging
import sys

from .settings import get_settings


def configure_logging() -> None:
    settings = get_settings()
    level = logging.DEBUG if settings.debug else logging.INFO

    root = logging.getLogger()
    root.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    root.handlers = [handler]

    # Silence noisy low-level connection debug logs from http libraries
    for noisy in ("httpcore", "httpx", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
