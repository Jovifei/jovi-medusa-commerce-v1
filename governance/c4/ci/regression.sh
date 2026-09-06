#!/usr/bin/env bash
# C4 Runtime PR regression harness.
#
# This script preserves historical R6/C2 evidence scripts and provides a
# cross-platform CI harness for the current C3-derived audited Runtime tree.
# It performs synthetic-only tests in an isolated Docker network and never
# touches a real payment, customer, Xianyu account, or delivery channel.
set -euo pipefail

export MSYS_NO_PATHCONV=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
if command -v cygpath >/dev/null 2>&1; then
  REPO_DOCKER_ROOT="$(cygpath -m "$REPO_ROOT")"
else
  REPO_DOCKER_ROOT="$REPO_ROOT"
fi

BACKEND="$REPO_DOCKER_ROOT/audit-source/backend/jovi-medusa-backend"
TESTS="$REPO_DOCKER_ROOT/audit-source/tests"
OUT_BASE="${RUNNER_TEMP:-$REPO_ROOT/.tmp}"
OUT="${C4_CI_EVIDENCE_OUT:-$OUT_BASE/jovi-c4-runtime-regression}"
mkdir -p "$OUT"
LOG="$OUT/regression.log"
: > "$LOG"
log(){ echo "[c4-ci] $*" | tee -a "$LOG"; }

# Current audited C3-derived audit-source canonical hash, recomputed by
# governance/r6/ci/verify_source_tree.py at the C4 PR gate.
SRC_SHA="3101604bf10c9c6ed3c9b67a23e5ef77a6704472835ccfd536c2cc0b6b8e568a"
LOCK_SHA="9855eabfc4fc37d916af0ac64585f15594b44a90dc6d8488d594789956237119"
IMG="jovi-medusa-c4-ci-backend:local"
NS="jovi-medusa-c4-ci"
DB="$NS-db"; REDIS="$NS-redis"; BE="$NS-backend"
PGV="$NS-pgdata"; RDV="$NS-redisdata"; NET="$NS-internal"
JWT="c4-ci-synthetic-jwt-not-production"
COOKIE="c4-ci-synthetic-cookie-not-production"

cleanup(){
  log "cleanup"
  docker rm -f "$BE" "$REDIS" "$DB" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  docker volume rm "$PGV" "$RDV" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "build image from current audited Runtime source"
docker build --progress=plain \
  --build-arg "JOVI_SOURCE_TREE_SHA=$SRC_SHA" \
  --build-arg "JOVI_LOCK_SHA=$LOCK_SHA" \
  -t "$IMG" "$BACKEND" > "$OUT/build.log" 2>&1 || {
    tail -50 "$OUT/build.log" || true
    exit 1
  }

log "create isolated internal network"
docker network create -d bridge --internal "$NET" >/dev/null

log "boot postgres"
docker volume create "$PGV" >/dev/null
docker run -d --name "$DB" --network "$NET" -v "$PGV":/var/lib/postgresql/data \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=jovi_medusa_c4_ci \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685 >/dev/null

log "boot redis"
docker volume create "$RDV" >/dev/null
docker run -d --name "$REDIS" --network "$NET" -v "$RDV":/data \
  redis@sha256:1cd18c9774579b583415e2a1ce464f183e5ed15203c5d8195dcfc6b9dc710cd1 \
  redis-server --appendonly yes --appendfsync always >/dev/null

log "wait for postgres queryability"
DB_READY=""
for _ in $(seq 1 60); do
  if docker run --rm --network "$NET" "$IMG" sh -lc \
    "cd /workspace/apps/backend && node -e \"const {Client}=require('/workspace/node_modules/.pnpm/pg@8.23.0/node_modules/pg');const c=new Client({connectionString:'postgres://postgres@$DB:5432/jovi_medusa_c4_ci?sslmode=disable',ssl:false});c.connect().then(()=>c.end()).catch(()=>process.exit(1))\"" \
    >/dev/null 2>&1; then
    DB_READY=1
    break
  fi
  sleep 3
done
[ -n "$DB_READY" ] || { log "postgres never became queryable"; exit 1; }

log "boot backend with frozen synthetic fixtures"
docker run -d --name "$BE" --network "$NET" \
  -e NODE_ENV=production \
  -e "DATABASE_URL=postgres://postgres@$DB:5432/jovi_medusa_c4_ci?sslmode=disable" \
  -e 'DATABASE_DRIVER_OPTIONS={"connection":{"ssl":false}}' \
  -e "REDIS_URL=redis://$REDIS:6379" \
  -e "LOCKING_REDIS_URL=redis://$REDIS:6379" \
  -e "JOVI_FIXTURE_ROOT=/r2-tests/fixtures/synthetic-digital-checklist" \
  -e "JOVI_C2_FIXTURE_ROOT=/r2-tests/fixtures/c2-synthetic-digital-pack" \
  -e "JOVI_X2_EVIDENCE_ROOT=/workspace/runtime/evidence" \
  -e "JOVI_C2_EVIDENCE_ROOT=/workspace/runtime/evidence" \
  -e "JOVI_SYNTHETIC_LOOPBACK_HTTP=true" \
  -v "$TESTS:/r2-tests:ro" \
  -e "JWT_SECRET=$JWT" -e "COOKIE_SECRET=$COOKIE" \
  --entrypoint sh "$IMG" -lc \
  "cd /workspace/apps/backend && corepack pnpm --filter @dtc/backend exec medusa db:migrate && corepack pnpm --filter @dtc/backend exec medusa start -H 0.0.0.0 -p 9000" >/dev/null

log "wait for backend health"
BE_OK=""
for _ in $(seq 1 60); do
  if docker exec "$BE" sh -lc \
    "node -e \"require('http').get('http://127.0.0.1:9000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\"" \
    >/dev/null 2>&1; then
    BE_OK=1
    break
  fi
  sleep 3
done
if [ -z "$BE_OK" ]; then
  log "backend never became healthy"
  docker logs "$BE" 2>&1 | tail -60 | tee -a "$LOG" || true
  exit 1
fi

run(){
  local name="$1"; shift
  local command="$*"
  log "run $name"
  if docker exec \
      -e NODE_ENV=test \
      -e "DB_HOST=$DB" \
      -e DB_USERNAME=postgres \
      -e DB_PORT=5432 \
      "$BE" sh -lc "cd /workspace/apps/backend && $command" \
      > "$OUT/$name.out" 2> "$OUT/$name.err"; then
    log "PASS $name"
  else
    log "FAIL $name"
    tail -80 "$OUT/$name.err" | tee -a "$LOG" || true
    tail -80 "$OUT/$name.out" | tee -a "$LOG" || true
    return 1
  fi
}

# Current synthetic regression surface inherited from C2/C3.
run jest-unit "TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules corepack pnpm exec jest --silent --runInBand"
run jest-integration "TEST_TYPE=integration:modules NODE_OPTIONS=--experimental-vm-modules corepack pnpm exec jest src/modules/jovi-commerce/__tests__/service.spec.ts --silent=false --runInBand"
run x2-first "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2.ts"
run x2-replay "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2.ts"
run x2-concurrency "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2-concurrency.ts"
run x2-negative "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-x2-negative.ts"
run c2-first "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2.ts"
run c2-replay "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-replay.ts"
run c2-concurrency "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-concurrency.ts"
run c2-negative "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-negative.ts"
run c2-http-download "TEST_TYPE=integration:modules corepack pnpm --filter @dtc/backend exec medusa exec src/scripts/jovi-c2-http-download.ts"

log "C4_RUNTIME_SYNTHETIC_REGRESSION_PASS"
