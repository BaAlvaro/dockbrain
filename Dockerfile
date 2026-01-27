# DockBrain Dockerfile
# Multi-stage build for optimized image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY config ./config

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Create non-root user
RUN addgroup -g 1001 dockbrain && \
    adduser -D -u 1001 -G dockbrain dockbrain

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Copy .env.example for reference
COPY .env.example ./

# Create data directories with correct permissions
RUN mkdir -p data/logs data/safe_root && \
    chown -R dockbrain:dockbrain /app

# Switch to non-root user
USER dockbrain

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start application
CMD ["node", "dist/main.js"]
