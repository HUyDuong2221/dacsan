FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install the exact dependency versions tested locally, including the PDF worker.
# Surface lifecycle-script errors directly in the Docker build output.
# Reuse downloaded packages across builds and retry transient registry failures.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund --foreground-scripts --prefer-offline \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=10000 \
      --fetch-retry-maxtimeout=60000 \
      --fetch-timeout=300000
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_MEDIA_BASE_URL=http://localhost:8000/media
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
