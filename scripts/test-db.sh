#!/usr/bin/env bash
# Applies all migrations to a throwaway database and runs each database test file on a fresh copy.
# Usage: DATABASE_URL=postgres://user:pass@host:port/postgres scripts/test-db.sh
# Works against a local Postgres or `supabase start` (postgresql://postgres:postgres@127.0.0.1:54322/postgres).
#
# ONE DATABASE PER TEST FILE (§6.184): the files share actor ids (the same "admin", "advisor", "stranger"), so
# running them into one database collides. Each gets the migrations applied from scratch.
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to a Postgres superuser connection}"
TESTS=(tenant_isolation client_access team billing)
DB=""
trap '[ -n "$DB" ] && psql "$DATABASE_URL" -q -c "drop database if exists $DB" >/dev/null' EXIT
for t in "${TESTS[@]}"; do
  DB="bp_test_$$_$t"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "create database $DB"
  TEST_URL="${DATABASE_URL%/*}/$DB"
  # stub auth and storage only if the target has none (plain Postgres); Supabase already has them
  if ! psql "$TEST_URL" -Atq -c "select 1 from pg_namespace where nspname='auth'" | grep -q 1; then
    psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_auth_stub.sql
  fi
  for f in supabase/migrations/*.sql; do
    psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
  done
  echo "running $t"
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -Atq -f "supabase/tests/$t.sql" | tail -1
  psql "$DATABASE_URL" -q -c "drop database if exists $DB" >/dev/null
  DB=""
done
