from httpx import Client

from backend.config.settings import get_settings

_client: Client | None = None


def get_supabase_client() -> Client | None:
    global _client
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        return None
    if _client is None:
        _client = Client(
            base_url=settings.supabase_url,
            headers={
                "Authorization": f"Bearer {settings.supabase_key}",
                "apiKey": settings.supabase_key,
            },
        )
    return _client
