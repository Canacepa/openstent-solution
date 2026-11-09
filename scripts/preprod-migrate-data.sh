#!/usr/bin/env bash
# Moves the development content (news, team, checklist) and the team photos to the pre-production
# stack. The schema itself is created by the Doctrine migrations when the app container starts.
#
#   scripts/preprod-migrate-data.sh            # first load: refuses to overwrite existing content
#   FORCE=1 scripts/preprod-migrate-data.sh    # replace the content already in pre-production
#
# Run it from the machine where the development database is reachable (it reads .env.local).
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f compose.yaml -f compose.preprod.yaml --env-file .env.preprod)
EXPORT=var/content-export.json

[ -f .env.preprod ] || { echo ".env.preprod is missing (copy .env.preprod.example)." >&2; exit 1; }

echo "1/3 exporting the development content to $EXPORT"
php bin/console app:export-content "$EXPORT"

echo "2/3 copying the file and the team photos into the app container"
"${COMPOSE[@]}" cp "$EXPORT" app:/app/var/content-export.json
if [ -d public/uploads ]; then
    "${COMPOSE[@]}" cp public/uploads/. app:/app/public/uploads/
fi

echo "3/3 importing in pre-production"
"${COMPOSE[@]}" exec -T app php bin/console app:import-content var/content-export.json ${FORCE:+--force}

echo "Done. Create the admin account with:"
echo "  ${COMPOSE[*]} exec app php bin/console app:create-admin you@example.com"
