import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mktemp(suffix='.db')}"
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-at-least-thirty-two-characters-long")
os.environ["REDIS_URL"] = "redis://localhost:6379/1"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config.database import Base


@pytest.fixture(autouse=True)
def _test_db():
    import backend.config.database as db_module
    from backend.config.settings import get_settings

    get_settings.cache_clear()

    test_db = tempfile.mktemp(suffix=".db")
    engine = create_engine(f"sqlite:///{test_db}", connect_args={"check_same_thread": False, "timeout": 30})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    db_module.engine = engine
    db_module.SessionLocal = SessionLocal

    yield

    Base.metadata.drop_all(bind=engine)
    db_module.engine.dispose()
    try:
        os.unlink(test_db)
    except OSError:
        pass
