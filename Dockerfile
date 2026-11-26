# Sajilo for local judging: builds apps/main and runs it with `next start`.
# docker-compose.yml supplies Postgres, the local Neon proxy and the demo book.
FROM node:22-bookworm-slim
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .
RUN pnpm install --frozen-lockfile

# Build-time placeholders only (env.ts checks they exist); real values come from docker-compose.yml.
ENV NEXT_PUBLIC_SITE_URL=http://localhost:3100
RUN DATABASE_URL=postgres://build:build@localhost:5432/build BETTER_AUTH_SECRET=build-only-placeholder-secret-0000 \
    pnpm --filter main build

WORKDIR /repo/apps/main
EXPOSE 3100
CMD ["pnpm", "start", "--port", "3100"]
