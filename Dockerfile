# Base image with Bun
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN bun run build

# Bundle idempotent migration script with all dependencies
RUN bun build src/db/migrate-idempotent.ts --target=bun --outfile=migrate-idempotent.js
RUN bun build src/worker/index.ts --target=bun --outfile=worker.js

# Final runtime image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Python + diarization library (CPU-only speaker fingerprinting)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv libsndfile1 libgomp1 ffmpeg && \
    python3 -m venv /opt/diarize && \
    /opt/diarize/bin/pip install --no-cache-dir diarize && \
    rm -rf /var/lib/apt/lists/*

# Make the venv's python3 the default for our scripts
ENV PATH="/opt/diarize/bin:$PATH"

# Copy Next.js standalone output + public files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy bundled idempotent migration script (no node_modules needed!)
COPY --from=builder /app/migrate-idempotent.js ./migrate-idempotent.js
COPY --from=builder /app/worker.js ./worker.js

# Copy migrations folder
COPY --from=builder /app/src/db/migrations ./src/db/migrations

# Copy diarization script
COPY scripts/run-diarize.py ./scripts/run-diarize.py

# Copy entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "server.js"]
