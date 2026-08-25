#!/usr/bin/env bash
# PostgreSQL setup script for casuya-platform
set -euo pipefail

# Environment variables
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
POSTGRES_DB=${POSTGRES_DB:-casuya_platform}

# Check if PostgreSQL client tools are available
if ! command -v psql >/dev/null 2>&1; then
    echo "psql not found. Please install PostgreSQL client."
    exit 1
fi

# Test connection to PostgreSQL
echo "Testing PostgreSQL connection..."
if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -c 'SELECT 1' >/dev/null 2>&1; then
    echo "PostgreSQL is not accessible. Please check credentials."
    exit 1
fi

echo "PostgreSQL is accessible."

# Check if the database exists
if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -lqt | cut -d| -f1 | grep -w "$POSTGRES_DB" >/dev/null 2>&1; then
    echo "Creating database $POSTGRES_DB..."
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -c "CREATE DATABASE \"$POSTGRES_DB\""
    echo "Database $POSTGRES_DB created."
else
    echo "Database $POSTGRES_DB already exists."
fi

echo "PostgreSQL setup complete."
echo "Database URL: postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
