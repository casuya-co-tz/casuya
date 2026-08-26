from httpx import Client

from backend.config.settings import get_settings


def purge_cache(paths: list[str]):
    settings = get_settings()
    if not settings.cloudflare_zone_id or not settings.cloudflare_api_token:
        return
    client = Client(
        base_url="https://api.cloudflare.com/client/v4",
        headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
    )
    resp = client.post(
        f"/zones/{settings.cloudflare_zone_id}/purge_cache",
        json={"files": paths},
    )
    resp.raise_for_status()


def purge_cache_tags(tags: list[str]):
    """Purge everything carrying one of these Cache-Tags (e.g. "lesson-content").

    Safe no-op when Cloudflare credentials are absent. Pair with a Cache-Tag
    response header on the cached asset so an edit can bust the edge copy.
    """
    settings = get_settings()
    if not settings.cloudflare_zone_id or not settings.cloudflare_api_token:
        return
    client = Client(
        base_url="https://api.cloudflare.com/client/v4",
        headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
    )
    resp = client.post(
        f"/zones/{settings.cloudflare_zone_id}/purge_cache",
        json={"tags": tags},
    )
    resp.raise_for_status()
