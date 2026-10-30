#!/usr/bin/env bash
# Runs PostgreSQL 16 and Redis 7 inside WSL Ubuntu 24.04 WITHOUT root, using official Ubuntu
# packages extracted into ~/crm-infra. Used for local development on Windows without Docker.
#
#   One-time setup:  bash scripts/wsl-infra.sh setup <postgres-password>
#   Start services:  bash scripts/wsl-infra.sh start     (keep the terminal open)
#
# WSL2 forwards localhost, so Windows apps reach Postgres on localhost:5432 and Redis on :6379.
set -euo pipefail
ROOT="$HOME/crm-infra"
LIBS="$ROOT/root/usr/lib/x86_64-linux-gnu"
PGBIN="$ROOT/root/usr/lib/postgresql/16/bin"

case "${1:-start}" in
  setup)
    PASSWORD="${2:?usage: setup <postgres-password>}"
    mkdir -p "$ROOT/debs" "$ROOT/root" "$ROOT/run" "$ROOT/redis-data"
    cd "$ROOT/debs"
    apt-get download postgresql-16 postgresql-client-16 libpq5 libjemalloc2 liblzf1 libatomic1
    for p in redis-server redis-tools; do
      [ -f ${p}_*.deb ] || apt-get download "$p"
    done
    for f in *.deb; do dpkg -x "$f" "$ROOT/root"; done
    echo "$PASSWORD" > "$ROOT/.pwfile"
    LD_LIBRARY_PATH="$LIBS" "$PGBIN/initdb" -D "$ROOT/pgdata" -U crm --pwfile="$ROOT/.pwfile" -A scram-sha-256 -E UTF8 --locale=C.UTF-8
    rm "$ROOT/.pwfile"
    {
      echo "listen_addresses = '*'"
      echo "unix_socket_directories = '$ROOT/run'"
    } >> "$ROOT/pgdata/postgresql.conf"
    echo "host all all 0.0.0.0/0 scram-sha-256" >> "$ROOT/pgdata/pg_hba.conf"
    echo "Setup complete. Run: bash scripts/wsl-infra.sh start"
    ;;
  start)
    export LD_LIBRARY_PATH="$LIBS"
    "$ROOT/root/usr/bin/redis-server" --bind 127.0.0.1 --port 6379 --dir "$ROOT/redis-data" --appendonly yes --daemonize no &
    exec "$PGBIN/postgres" -D "$ROOT/pgdata"
    ;;
  *)
    echo "usage: $0 setup <password> | start" >&2
    exit 1
    ;;
esac
