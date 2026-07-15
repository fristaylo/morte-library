FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY . .
RUN bun run build

FROM oven/bun:1-alpine AS api
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production

COPY server ./server
EXPOSE 3001
CMD ["bun", "run", "server/index.ts"]

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
