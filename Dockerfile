# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_TIANDITU_KEY
ENV NEXT_PUBLIC_TIANDITU_KEY=$NEXT_PUBLIC_TIANDITU_KEY
ARG NEXT_PUBLIC_GIT_HASH=unknown
ENV NEXT_PUBLIC_GIT_HASH=$NEXT_PUBLIC_GIT_HASH
RUN npm run build && npm exec esbuild -- src/workers/entry.ts --bundle --platform=node --external:better-sqlite3 --outfile=job-worker.cjs && npm exec esbuild -- src/workers/migrate-entry.ts --bundle --platform=node --external:better-sqlite3 --outfile=migrate.cjs && npm exec esbuild -- src/workers/create-user-entry.ts --bundle --platform=node --external:better-sqlite3 --outfile=create-user.cjs
FROM python:3.14-slim-bookworm@sha256:48b13b003dda20b16f9442b8475aa05fe21bf6579a8c881db92ffb4d8fd20f83 AS runtime
WORKDIR /app
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 DEPLOYMENT_TIER=pilot PYTHONUNBUFFERED=1 ANALYTICS_PYTHON=/opt/venv/bin/python PATH=/opt/venv/bin:$PATH
COPY requirements.txt requirements.lock ./
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.lock && useradd -m -u 1000 app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/job-worker.cjs /app/migrate.cjs /app/create-user.cjs ./
COPY --chown=app:app analytics_engine ./analytics_engine
COPY --chown=app:app config ./config
COPY --chown=app:app ["henan city border.geojson", "henan county border.geojson", "henan province border.geojson", "./"]
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app docker/entrypoint.sh ./docker/entrypoint.sh
RUN mkdir -p /app/data && chown app:app /app/data && chmod 0755 docker/entrypoint.sh
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker/entrypoint.sh"]
