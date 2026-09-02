#!/usr/bin/env bash
# R6 full synthetic Commerce regression over the CONTROLLED imported audited source.
#
# Runs entirely in an isolated namespace (jovi-medusa-r6) with its own fresh
# PostgreSQL + Redis on private loopback-only docker networks, so it never touches
# the still-running R2-R2 verification stack or its data. Synthetic-only.
#
# Steps mirror the R2-R2 evidence flow: build backend image from audited source,
# boot db/redis/backend, migrate, Jest unit + integration, X2 first/replay,
# 10-way concurrency, negative cases. Oracle + PID1 recovery are recorded as the
# byte-identical audited behavior carried into the repo (see governance README).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# Docker Desktop on Windows cannot use MSYS POSIX paths (/e/...). Convert the
# repo root to a Windows path (E:/...) for every docker build context / bind-mount
# argument. cygpath -m emits E:/project/... (forward slashes, drive-prefixed).
REPO_ROOT_WIN="$(cygpath -m "$REPO_ROOT")"
BACKEND="$REPO_ROOT_WIN/audit-source/backend/jovi-medusa-backend"
APP="$BACKEND/apps/backend"
OUT="${R6_EVIDENCE_OUT:-$REPO_ROOT/governance/r6/post-import-evidence}"
NS="jovi-medusa-r6"
mkdir -p "$OUT"
LOG="$OUT/regression.log"
: > "$LOG"
log(){ echo "[r6] $*" | tee -a "$LOG"; }

SRC_SHA="e533f0ce0010cc0f75848b9854d8ccd4da364768f31174349d8981827342f8aa"
LOCK_SHA="9855eabfc4fc37d916af0ac64585f15594b44a90dc6d8488d594789956237119"
IMG="jovi-medusa-r6-backend:local"
DB="$NS-db"; REDIS="$NS-redis"; BE="$NS-backend"
PGV="pgdata-r6"; RDV="redisdata-r6"
NET="$NS-internal"
JWT="${MEDUSA_R6_JWT_SECRET:-r6-synthetic-jwt-not-production}"
COOKIE="${MEDUSA_R6_COOKIE_SECRET:-r6-synthetic-cookie-not-production}"

cleanup(){ log "cleanup"; docker rm -f "$BE" "$REDIS" "$DB" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; docker volume rm "$PGV" "$RDV" >/dev/null 2>&1 || true; }
trap cleanup EXIT

log "build image from imported audited source ($IMG)"
docker build --progress=plain \
  --build-arg "JOVI_SOURCE_TREE_SHA=$SRC_SHA" --build-arg "JOVI_LOCK_SHA=$LOCK_SHA" \
  -t "$IMG" "$BACKEND" > "$OUT/build.log" 2>&1 || { tail -30 "$OUT/build.log"; exit 1; }

log "create isolated network $NET"
docker network create -d bridge --internal "$NET" >/dev/null

log "boot postgres"
docker volume create "$PGV" >/dev/null
docker run -d --name "$DB" --network "$NET" -v "$PGV":/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres -e POSTGRES_DB=jovi_medusa_r6 -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685 >/dev/null

log "boot redis"
docker volume create "$RDV" >/dev/null
docker run -d --name "$REDIS" --network "$NET" -v "$RDV":/data \
  redis@sha256:1cd18c9774579b583415e2a1ce464f183e5ed15203c5d8195dcfc6b9dc710cd1 \
  redis-server --appendonly yes --appendfsync always >/dev/null

log "wait postgres ready (real query on target DB)"
# pg_isready can report "accepting connections" while postgres is still finishing
# initdb on a FRESH volume. That race makes the backend's db:migrate time out. Poll
# until a real SELECT on the target database succeeds (run from the backend image on
# the same isolated network), which guarantees init is complete before backend boot.
DB_READY=""
for i in $(seq 1 60); do
  if docker run --rm --network "$NET" "$IMG" sh -lc \
    "cd /workspace/apps/backend && node -e \"const {Client}=require('/workspace/node_modules/.pnpm/pg@8.23.0/node_modules/pg');const c=new Client({connectionString:'postgres://postgres@$DB:5432/jovi_medusa_r6?sslmode=disable',ssl:false});c.connect().then(()=>c.end()).catch(()=>process.exit(1))\"" \
    >/dev/null 2>&1; then DB_READY=1; break; fi
  sleep 3
done
[ -n "$DB_READY" ] || { log "postgres never became queryable"; exit 1; }

log "boot backend (migrate then start)"
docker run -d --name "$BE" --network "$NET" \
  -e NODE_ENV=production \
  -e "DATABASE_URL=postgres://postgres@$DB:5432/jovi_medusa_r6?sslmode=disable" \
  -e 'DATABASE_DRIVER_OPTIONS={"connection":{"ssl":false}}' \
  -e "REDIS_URL=redis://$REDIS:6379" \
  -e "LOCKING_REDIS_URL=redis://$REDIS:6379" \
  -e "JOVI_FIXTURE_ROOT=/r2-tests/fixtures/synthetic-digital-checklist" \
  -e "JOVI_X2_EVIDENCE_ROOT=/workspace/runtime/evidence" \
  -v "$REPO_ROOT_WIN/audit-source/tests:/r2-tests:ro" \
  -e "JWT_SECRET=$JWT" -e "COOKIE_SECRET=$COOKIE" \
  --entrypoint sh "$IMG" -lc \
  "cd /workspace/apps/backend && corepack pnpm --filter @dtc/backend exec medusa db:migrate && corepack pnpm --filter @dtc/backend exec medusa start -H 0.0.0.0 -p 9000" >/dev/null

log "wait backend healthy (9000)"
BE_OK=""
for i in $(seq 1 60); do
  if docker exec "$BE" sh -lc "node -e \"require('http').get('http://127.0.0.1:9000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\"" >/dev/null 2>&1; then BE_OK=1; break; fi
  sleep 3
done
if [ -z "$BE_OK" ]; then
  log "backend never became healthy; container logs:"
  docker logs "$BE" 2>&1 | tail -40 | tee -a "$LOG"
  exit 1
fi
log "backend healthy"

# @medusajs/test-utils ModuleTestRunner creates isolated temp DBs and connects to
# postgres via DB_HOST/DB_USERNAME/DB_PORT env (defaults to localhost:5432). Inside
# this isolated internal network the postgres server is "$DB", so inject those vars
# on every test exec (X2 scripts run via medusa exec and use the container DATABASE_URL).
run(){ log "run $1"; docker exec -e NODE_ENV=test -e "DB_HOST=$DB" -e DB_USERNAME=postgres -e DB_PORT=5432 "$BE" sh -lc "cd /workspace/apps/backend && $2" > "$OUT/$1.out" 2> "$OUT/$1.err"; echo "exit=$? script=$1" | tee -a "$LOG"; }

# TypeScript already covered in static job; here the image build ran `tsc --noEmit`.

# Jest unit (natural shutdown)
run jest-unit "TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules corepack pnpm exec jest --silent --runInBand"
# Jest module integration
run jest-integration "TEST_TYPE=integration:modules NODE_OPTIONS=--experimental-vm-modules corepack pnpm exec jest src/modules/jovi-commerce/__tests__/service.spec.ts --silent=false --runInBand"
# X2 first / replay / concurrency / negative
run x2-first "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2.ts"
run x2-replay "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2.ts"
run x2-concurrency "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2-concurrency.ts"
run x2-negative "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2-negative.ts"

log "done; see $OUT"
