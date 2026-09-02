FROM node@sha256:ffb27ca0f26a231a08930c872631cea70cbb318463d1e712922b5c7cfdc3fcca AS build

ARG JOVI_SOURCE_TREE_SHA=UNBOUND
ARG JOVI_LOCK_SHA=UNBOUND

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN corepack enable && corepack prepare pnpm@10.32.0 --activate && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @dtc/backend exec tsc --noEmit
RUN pnpm --filter @dtc/backend exec medusa build
RUN mkdir -p apps/backend/public/admin && cp -R apps/backend/.medusa/server/public/admin/. apps/backend/public/admin/

FROM node@sha256:ffb27ca0f26a231a08930c872631cea70cbb318463d1e712922b5c7cfdc3fcca AS runtime

ARG JOVI_SOURCE_TREE_SHA=UNBOUND
ARG JOVI_LOCK_SHA=UNBOUND
LABEL org.opencontainers.image.title="jovi-medusa-r2-synthetic" \
      org.opencontainers.image.source-tree-sha="$JOVI_SOURCE_TREE_SHA" \
      org.opencontainers.image.lock-sha="$JOVI_LOCK_SHA" \
      org.opencontainers.image.medusa-version="2.19.0"

WORKDIR /workspace
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.32.0 --activate
COPY --from=build /workspace /workspace
EXPOSE 9000
CMD ["corepack", "pnpm", "--filter", "@dtc/backend", "exec", "medusa", "start", "-H", "0.0.0.0", "-p", "9000"]
