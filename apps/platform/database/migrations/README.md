# Database Migrations

Managed with Alembic.

## Setup

```bash
pip install alembic
alembic init alembic
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Commands

```bash
# Create new migration
alembic revision --autogenerate -m "add_column_x"

# Apply all pending migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1

# Show current revision
alembic current

# Show history
alembic history
```

## CI

Migrations are run automatically in CI and at container startup.
