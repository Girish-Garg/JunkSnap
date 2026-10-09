# One image, three entry points:
#   api (default):  node dist/handlers/web.js
#   worker:         node dist/handlers/worker.js
#   scores CronJob: node dist/handlers/scores.js
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
# Dependencies first, so code changes reuse this layer; sharp's linux-x64 binary comes from the lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist

# Numeric user and group, so Kubernetes runAsNonRoot can verify them.
USER 10001:10001
EXPOSE 8000
CMD ["node", "dist/handlers/web.js"]
