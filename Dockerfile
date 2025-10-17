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

# Build TypeScript and ensure dist directory exists
RUN (npm run build:backend || echo "No TypeScript build configured") && \
    mkdir -p /app/dist

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

# Copy built TypeScript (directory always exists from builder)
COPY --from=builder --chown=chessapp:nodejs /app/dist ./dist

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/tmp /app/otb-database /app/data && \
    chown -R chessapp:nodejs /app/logs /app/tmp /app/otb-database /app/data && \
    chmod -R 755 /app/data && \
    chmod +x start-railway.sh

# Switch to non-root user
USER chessapp

# Expose ports for different servers
# 3007: Legacy server
# 3009: Optimized server
# 3010: Production pooled server (recommended)
EXPOSE 3007 3009 3010

# Health check (will check PORT environment variable, defaults to 3010)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 3010; require('http').get('http://localhost:' + port + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use sh explicitly to run the startup script (Alpine Linux uses sh, not bash)
CMD ["/bin/sh", "./start-railway.sh"]
