# Multi-stage build for Chess Stats application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Development dependencies for building
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build:backend || echo "No TypeScript build configured"

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 chessapp

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=chessapp:nodejs . .

# Copy built TypeScript (if exists)
COPY --from=builder --chown=chessapp:nodejs /app/dist ./dist 2>/dev/null || true

# Create necessary directories
RUN mkdir -p /app/logs /app/tmp /app/otb-database && \
    chown -R chessapp:nodejs /app/logs /app/tmp /app/otb-database

# Switch to non-root user
USER chessapp

# Expose ports for different servers
# 3007: Legacy server
# 3009: Optimized server
# 3010: Production pooled server (recommended)
EXPOSE 3007 3009 3010

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Default to production pooled server (recommended)
CMD ["node", "simple-server-pooled.js"]
