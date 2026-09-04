#!/usr/bin/env bash
# Applies all migrations to a throwaway database and runs the tenant-isolation tests.
# Usage: DATABASE_URL=postgres://user:pass@host:port/postgres scripts/test-db.sh
# Works against a local Postgres or `supabase start` (postgresql://postgres:postgres@127.0.0.1:54322/postgres).
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to a Postgres superuser connection}"
DB="bp_test_$$"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "create database $DB"
TEST_URL="${DATABASE_URL%/*}/$DB"
trap 'psql "$DATABASE_URL" -q -c "drop database if exists $DB" >/dev/null' EXIT
# stub auth schema only if the target has none (plain Postgres); Supabase already has it
if ! psql "$TEST_URL" -Atq -c "select 1 from pg_namespace where nspname='auth'" | grep -q 1; then
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_auth_stub.sql
fi
for f in supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"; psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "running tenant isolation tests"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -Atq -f supabase/tests/tenant_isolation.sql | tail -1
