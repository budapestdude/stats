#!/bin/bash

# Chess Stats Production Build Script
# This script prepares the application for production deployment

set -e

echo "🚀 Building Chess Stats for Production"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check Node.js version
NODE_VERSION=$(node -v)
print_status "Node.js version: $NODE_VERSION"

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf dist/
rm -rf frontend/.next/
rm -rf frontend/out/
rm -rf logs/*.log

# Install dependencies
print_status "Installing backend dependencies..."
npm ci --production=false

print_status "Installing frontend dependencies..."
cd frontend
npm ci --production=false
cd ..

# Run tests
print_status "Running backend tests..."
npm test -- --silent --coverage || {
    print_error "Tests failed. Aborting build."
    exit 1
}

# Check test coverage
COVERAGE=$(npm test -- --silent --coverage --coverageReporters=text-summary | grep "Lines" | awk '{print $3}' | sed 's/%//')
if [ "$COVERAGE" -lt 70 ]; then
    print_warning "Test coverage is below 70% (${COVERAGE}%). Consider adding more tests."
fi

# Lint code
print_status "Linting backend code..."
npm run lint || {
    print_warning "Linting issues found. Please fix them."
}

print_status "Linting frontend code..."
cd frontend
npm run lint || {
    print_warning "Frontend linting issues found."
}
cd ..

# Build TypeScript backend
print_status "Building TypeScript backend..."
npm run build

# Build Next.js frontend
print_status "Building Next.js frontend..."
cd frontend
npm run build

# Export static frontend (if needed)
if [ "$STATIC_EXPORT" = "true" ]; then
    print_status "Exporting static frontend..."
    npm run export
fi
cd ..

# Optimize database
print_status "Optimizing database..."
node scripts/optimize-db.js || {
    print_warning "Database optimization failed. Continuing..."
}

# Generate production secrets if not exists
if [ ! -f ".env.production.local" ]; then
    print_status "Generating production secrets..."
    node scripts/generate-secrets.js
fi

# Create production directories
print_status "Creating production directories..."
mkdir -p logs
mkdir -p backups
mkdir -p uploads
mkdir -p temp

# Set proper permissions
print_status "Setting file permissions..."
chmod 755 logs
chmod 755 backups
chmod 700 uploads
chmod 755 temp

# Bundle production files
print_status "Creating production bundle..."
mkdir -p production-bundle

# Copy necessary files
cp -r dist production-bundle/
cp -r frontend/.next production-bundle/frontend-next
cp -r frontend/public production-bundle/public
cp -r otb-database production-bundle/
cp package.json production-bundle/
cp package-lock.json production-bundle/
cp ecosystem.config.js production-bundle/ 2>/dev/null || true

# Copy production servers
cp simple-server.js production-bundle/
cp simple-server-optimized.js production-bundle/
cp simple-server-pooled.js production-bundle/

# Copy configuration files
cp -r nginx production-bundle/ 2>/dev/null || true
cp docker-compose.yml production-bundle/
cp Dockerfile production-bundle/

# Create start script
cat > production-bundle/start.sh << 'EOF'
#!/bin/bash
# Production start script

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | xargs)
fi

# Start the production server
NODE_ENV=production node simple-server-pooled.js
EOF

chmod +x production-bundle/start.sh

# Install production dependencies only
print_status "Installing production dependencies in bundle..."
cd production-bundle
npm ci --production
cd ..

# Compress bundle
print_status "Compressing production bundle..."
tar -czf chess-stats-production-$(date +%Y%m%d-%H%M%S).tar.gz production-bundle/

# Clean up
rm -rf production-bundle/

# Generate build info
BUILD_INFO="build-info.json"
cat > $BUILD_INFO << EOF
{
  "version": "$(node -p "require('./package.json').version")",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "nodeVersion": "$NODE_VERSION",
  "environment": "production",
  "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF

print_status "Build info saved to $BUILD_INFO"

# Final checks
print_status "Running final checks..."

# Check for sensitive data
if grep -r "password\|secret\|key\|token" .env.example > /dev/null 2>&1; then
    print_warning "Potential sensitive data found in .env.example"
fi

# Check for console.log in production code
if grep -r "console.log" dist/ > /dev/null 2>&1; then
    print_warning "console.log statements found in production code"
fi

echo ""
echo "======================================"
echo -e "${GREEN}✅ Production build completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the build at: chess-stats-production-*.tar.gz"
echo "2. Deploy to your production server"
echo "3. Set up environment variables on the server"
echo "4. Configure nginx/Apache for reverse proxy"
echo "5. Set up SSL certificates"
echo "6. Start the application with PM2 or systemd"
echo ""
echo "Deployment command:"
echo "  scp chess-stats-production-*.tar.gz user@server:/path/to/deploy/"
echo "  ssh user@server"
echo "  tar -xzf chess-stats-production-*.tar.gz"
echo "  cd production-bundle"
echo "  ./start.sh"