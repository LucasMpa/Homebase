#!/bin/sh
# Aplica supabase/migrations que ainda não rodaram e, num banco novo, o seed.sql.
# Registra em supabase_migrations.schema_migrations, a mesma tabela da Supabase CLI.
set -eu

run() { psql -v ON_ERROR_STOP=1 --no-psqlrc -q "$@"; }

run <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

fresh=$(run -tAc "select count(*) = 0 from supabase_migrations.schema_migrations")

for file in /migrations/*.sql; do
  [ -e "$file" ] || continue
  base=$(basename "$file" .sql)
  version=${base%%_*}
  name=${base#*_}
  if [ -n "$(run -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")" ]; then
    continue
  fi
  echo "migrate: aplicando $base"
  { cat "$file"; printf '\ninsert into supabase_migrations.schema_migrations (version, name) values (%s, %s);\n' "'$version'" "'$name'"; } \
    | run --single-transaction
done

if [ "$fresh" = t ] && [ -f /seed.sql ]; then
  echo "migrate: aplicando seed.sql"
  run -f /seed.sql
fi

run -c "notify pgrst, 'reload schema'"
echo "migrate: ok"
