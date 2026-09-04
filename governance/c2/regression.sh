#!/usr/bin/env bash
# C2 full regression over the updated audited source tree (82 files).
set -euo pipefail

export MSYS_NO_PATHCONV=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT_WIN="$(cygpath -m "$REPO_ROOT")"
BACKEND="$REPO_ROOT_WIN/audit-source/backend/jovi-medusa-backend"
OUT="${C2_EVIDENCE_OUT:-$REPO_ROOT/governance/c2}"
NS="jovi-medusa-c2-reg"
mkdir -p "$OUT"
LOG="$OUT/regression.log"
: > "$LOG"
log(){ echo "[c2] $*" | tee -a "$LOG"; }

SRC_SHA="e3afca520386f043820dd7811a5b6ceb0dc7c8f9caa6c268f01d25edc347ed11"
LOCK_SHA="9855eabfc4fc37d916af0ac64585f15594b44a90dc6d8488d594789956237119"
IMG="jovi-medusa-c2-backend:local"
DB="$NS-db"; REDIS="$NS-redis"; BE="$NS-backend"
PGV="pgdata-c2"; RDV="redisdata-c2"
NET="$NS-internal"
JWT="c2-synthetic-jwt-not-production"
COOKIE="c2-synthetic-cookie-not-production"

cleanup(){ log "cleanup"; docker rm -f "$BE" "$REDIS" "$DB" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; docker volume rm "$PGV" "$RDV" >/dev/null 2>&1 || true; }
trap cleanup EXIT

log "build image from updated audited source ($IMG)"
docker build --progress=plain \
  --build-arg "JOVI_SOURCE_TREE_SHA=$SRC_SHA" --build-arg "JOVI_LOCK_SHA=$LOCK_SHA" \
  -t "$IMG" "$BACKEND" > "$OUT/build.log" 2>&1 || { tail -30 "$OUT/build.log"; exit 1; }

log "create isolated network $NET"
docker network create -d bridge --internal "$NET" >/dev/null

log "boot postgres"
docker volume create "$PGV" >/dev/null
docker run -d --name "$DB" --network "$NET" -v "$PGV":/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres -e POSTGRES_DB=jovi_medusa_c2 -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685 >/dev/null

log "boot redis"
docker volume create "$RDV" >/dev/null
docker run -d --name "$REDIS" --network "$NET" -v "$RDV":/data \
  redis@sha256:1cd18c9774579b583415e2a1ce464f183e5ed15203c5d8195dcfc6b9dc710cd1 \
  redis-server --appendonly yes --appendfsync always >/dev/null

log "wait postgres ready (real query on target DB)"
DB_READY=""
for i in $(seq 1 60); do
  if docker run --rm --network "$NET" "$IMG" sh -lc \
    "cd /workspace/apps/backend && node -e \"const {Client}=require('/workspace/node_modules/.pnpm/pg@8.23.0/node_modules/pg');const c=new Client({connectionString:'postgres://postgres@$DB:5432/jovi_medusa_c2?sslmode=disable',ssl:false});c.connect().then(()=>c.end()).catch(()=>process.exit(1))\"" \
    >/dev/null 2>&1; then DB_READY=1; break; fi
  sleep 3
done
[ -n "$DB_READY" ] || { log "postgres never became queryable"; exit 1; }

log "boot backend (migrate then start)"
docker run -d --name "$BE" --network "$NET" \
  -e NODE_ENV=production \
  -e "DATABASE_URL=postgres://postgres@$DB:5432/jovi_medusa_c2?sslmode=disable" \
  -e 'DATABASE_DRIVER_OPTIONS={"connection":{"ssl":false}}' \
  -e "REDIS_URL=redis://$REDIS:6379" \
  -e "LOCKING_REDIS_URL=redis://$REDIS:6379" \
  -e "JOVI_FIXTURE_ROOT=/r2-tests/fixtures/synthetic-digital-checklist" \
  -e "JOVI_C2_FIXTURE_ROOT=/r2-tests/fixtures/c2-synthetic-digital-pack" \
  -e "JOVI_X2_EVIDENCE_ROOT=/workspace/runtime/evidence" \
  -e "JOVI_C2_EVIDENCE_ROOT=/workspace/runtime/evidence" \
  -e "JOVI_SYNTHETIC_LOOPBACK_HTTP=true" \
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

run(){ log "run $1"; docker exec -e NODE_ENV=test -e "DB_HOST=$DB" -e DB_USERNAME=postgres -e DB_PORT=5432 "$BE" sh -lc "cd /workspace/apps/backend && $2" > "$OUT/$1.out" 2> "$OUT/$1.err"; echo "exit=$? script=$1" | tee -a "$LOG"; }

# Jest unit (9 suites / 41 tests)
run jest-unit "TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules corepack pnpm exec jest --silent --runInBand"

# Jest module integration
run jest-integration "TEST_TYPE=integration:modules NODE_OPTIONS=--experimental-vm-modules corepack pnpm exec jest src/modules/jovi-commerce/__tests__/service.spec.ts --silent=false --runInBand"

# X2 first / replay / concurrency / negative
run x2-first "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2.ts"
run x2-replay "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2.ts"
run x2-concurrency "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2-concurrency.ts"
run x2-negative "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2-negative.ts"

# C2 first / replay / concurrency / negative / http-download
run c2-first "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2.ts"
run c2-replay "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-replay.ts"
run c2-concurrency "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-concurrency.ts"
run c2-negative "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-negative.ts"
run c2-http-download "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-http-download.ts"

log "done; see $OUT"