FROM oven/bun:1-alpine
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production

COPY api ./api
EXPOSE 3001
CMD ["bun", "run", "api/index.ts"]
