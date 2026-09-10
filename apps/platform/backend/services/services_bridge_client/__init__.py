"""Casuya Services Bridge client.

Thin typed HTTP client for the casuya-services-bridge microservice which hosts
the content, exams, media, auth, analytics and search packages over HTTP.

Raises ConnectionError when the bridge is unreachable so callers can fall back
to local behaviour.
"""

from .base import ServicesBridgeClient, get_services_bridge_client

__all__ = ["ServicesBridgeClient", "get_services_bridge_client"]