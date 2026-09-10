"""FastAPI lifespan: drive the worker startup sequence then serve."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.startup import platform_startup


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run the one-time startup sequence (leader does DDL/rehydrate).

    ``platform_startup`` is an async generator that yields once after the cache
    sync is running; driving it with ``async for`` mirrors the original inline
    lifespan: startup code, then serving, then shutdown cleanup.
    """
    async for _ in platform_startup():
        yield