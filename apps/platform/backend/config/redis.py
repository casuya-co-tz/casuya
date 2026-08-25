"""Redis client that degrades gracefully when Redis is unavailable.

The backend should remain operational (serving reads, auth, lessons) even if
Redis is down. This wrapper lazily connects and swallows connection errors so
callers either get a safe fallback value or a no-op instead of an exception.
"""

from __future__ import annotations

from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from .settings import get_settings

settings = get_settings()


class SafeRedis:
    """Thin proxy around redis.Redis that never raises on connection issues."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._client: Redis | None = None
        self._available = False
        self._last_attempt = 0.0

    def _get(self) -> Redis | None:
        import time

        if self._client is None:
            now = time.time()
            if now - self._last_attempt < 10.0:
                return None
            self._last_attempt = now
            try:
                self._client = Redis.from_url(self._url, socket_connect_timeout=1)
                self._client.ping()
                self._available = True
            except RedisError:
                self._available = False
                self._client = None
        return self._client

    @property
    def available(self) -> bool:
        return self._get() is not None

    def ping(self) -> bool:
        client = self._get()
        return client is not None

    def get(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.get(*args, **kwargs)
        except RedisError:
            return None

    def set(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.set(*args, **kwargs)
        except RedisError:
            return None

    def setex(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.setex(*args, **kwargs)
        except RedisError:
            return None

    def keys(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return []
        try:
            return client.keys(*args, **kwargs)
        except RedisError:
            return []

    def delete(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.delete(*args, **kwargs)
        except RedisError:
            return None

    def exists(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return 0
        try:
            return client.exists(*args, **kwargs)
        except RedisError:
            return 0

    def expire(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.expire(*args, **kwargs)
        except RedisError:
            return None

    def incr(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return 0
        try:
            return client.incr(*args, **kwargs)
        except RedisError:
            return 0

    def hset(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.hset(*args, **kwargs)
        except RedisError:
            return None

    def hget(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.hget(*args, **kwargs)
        except RedisError:
            return None

    def zremrangebyscore(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return 0
        try:
            return client.zremrangebyscore(*args, **kwargs)
        except RedisError:
            return 0

    def zcard(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return 0
        try:
            return client.zcard(*args, **kwargs)
        except RedisError:
            return 0

    def zadd(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return 0
        try:
            return client.zadd(*args, **kwargs)
        except RedisError:
            return 0

    def ttl(self, *args: Any, **kwargs: Any) -> Any:
        client = self._get()
        if client is None:
            return -1
        try:
            return client.ttl(*args, **kwargs)
        except RedisError:
            return -1

    def flushdb(self) -> Any:
        client = self._get()
        if client is None:
            return None
        try:
            return client.flushdb()
        except RedisError:
            return None

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            except RedisError:
                pass


redis_client = SafeRedis(settings.redis_url)
