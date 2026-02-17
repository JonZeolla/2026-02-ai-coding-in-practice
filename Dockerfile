###################################
# Stage 1: Build UI (Vite)
###################################
FROM node:20-alpine AS ui-build

WORKDIR /app/ui

COPY ui/package.json ui/package-lock.json* ./
RUN npm install

COPY ui/ ./
RUN npm run build

###################################
# Stage 2: Build API (TypeScript)
###################################
FROM node:20-alpine AS api-build

WORKDIR /app/api

COPY api/package.json api/package-lock.json* ./
RUN npm install

COPY api/tsconfig.json ./
COPY api/src/ ./src/
RUN npm run build

###################################
# Stage 3: Build Worker (TypeScript)
###################################
FROM node:20-alpine AS worker-build

WORKDIR /app/worker

COPY worker/package.json worker/package-lock.json* ./
RUN npm install

COPY worker/tsconfig.json ./
COPY worker/src/ ./src/
RUN npm run build

###################################
# Stage 4: Runtime
###################################
FROM node:20-alpine

RUN apk add --no-cache nginx postgresql-client

# API: production dependencies + compiled output
WORKDIR /app/api
COPY api/package.json api/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=api-build /app/api/dist ./dist

# Worker: production dependencies + compiled output
WORKDIR /app/worker
COPY worker/package.json worker/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=worker-build /app/worker/dist ./dist

# UI: static files served by nginx
COPY --from=ui-build /app/ui/dist /usr/share/nginx/html

# Nginx configuration
COPY nginx.unified.conf /etc/nginx/http.d/default.conf

# Database schema
COPY db/init.sql /app/db/init.sql

# Entrypoint script
WORKDIR /app
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]
