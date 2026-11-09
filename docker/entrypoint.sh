#!/bin/sh
# Runs the database migrations (waiting for MySQL if needed), then starts the server.
set -eu

if [ "${1:-}" = "frankenphp" ]; then
    mkdir -p var public/uploads/team

    attempts=0
    until php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration; do
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 30 ]; then
            echo "The database migrations still fail after $attempts attempts, giving up." >&2
            exit 1
        fi
        echo "Database not ready or migration failed (attempt $attempts), retrying in 2 s..." >&2
        sleep 2
    done
fi

exec docker-php-entrypoint "$@"
