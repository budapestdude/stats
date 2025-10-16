#!/bin/bash

# Chess Stats Deployment Script
# Usage: ./scripts/deploy.sh [environment] [options]
# Options:
#   --skip-tests: Skip running tests
#   --skip-backup: Skip creating backup
#   --force: Force deployment even with warnings

set -e

ENVIRONMENT=${1:-production}
SKIP_TESTS=false
SKIP_BACKUP=false
FORCE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --skip-tests)
            SKIP_TESTS=true
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            ;;
        --force)
            FORCE=true
            ;;
    esac
done

echo "🚀 Deploying Chess Stats to $ENVIRONMENT environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    local errors=0
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        ((errors++))
    else
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        print_status "Docker version: $DOCKER_VERSION"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        ((errors++))
    else
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        print_status "Docker Compose version: $COMPOSE_VERSION"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_warning "Node.js is not installed (required for local testing)"
    else
        NODE_VERSION=$(node --version)
        print_status "Node.js version: $NODE_VERSION"
    fi
    
    # Check disk space
    AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
    print_status "Available disk space: $AVAILABLE_SPACE"
    
    # Check if .env file exists
    if [ ! -f ".env.$ENVIRONMENT" ]; then
        print_warning "Environment file .env.$ENVIRONMENT not found"
        if [ "$FORCE" != "true" ]; then
            print_error "Use --force to deploy without environment file"
            ((errors++))
        fi
    fi
    
    if [ $errors -gt 0 ]; then
        print_error "Prerequisites check failed with $errors errors"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        print_warning "Skipping tests (--skip-tests flag)"
        return
    fi
    
    echo "🧪 Running tests..."
    
    if command -v npm &> /dev/null; then
        npm test || {
            print_error "Tests failed!"
            if [ "$FORCE" != "true" ]; then
                exit 1
            fi
            print_warning "Continuing deployment despite test failures (--force flag)"
        }
        print_status "Tests passed"
    else
        print_warning "npm not found, skipping tests"
    fi
}

# Create backup
create_backup() {
    if [ "$SKIP_BACKUP" = "true" ]; then
        print_warning "Skipping backup (--skip-backup flag)"
        return
    fi
    
    echo "💾 Creating backup..."
    
    if [ -f "./scripts/backup.sh" ]; then
        ./scripts/backup.sh || {
            print_error "Backup failed!"
            if [ "$FORCE" != "true" ]; then
                exit 1
            fi
            print_warning "Continuing deployment despite backup failure (--force flag)"
        }
        print_status "Backup created successfully"
    else
        print_warning "Backup script not found"
    fi
}

# Build and start services
deploy() {
    echo "🏗️  Building and deploying services..."
    
    # Save current container IDs for rollback
    OLD_CONTAINERS=$(docker ps -q --filter "label=com.docker.compose.project=chess-stats" 2>/dev/null || echo "")
    
    # Stop existing containers
    print_warning "Stopping existing containers..."
    docker-compose down --remove-orphans
    
    # Prune old images to save space
    print_status "Cleaning up old images..."
    docker image prune -f
    
    # Build new images
    print_status "Building Docker images..."
    if ! docker-compose build --no-cache; then
        print_error "Docker build failed!"
        rollback
        exit 1
    fi
    
    # Start services
    print_status "Starting services..."
    if ! docker-compose up -d; then
        print_error "Failed to start services!"
        rollback
        exit 1
    fi
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    timeout=120
    while [ $timeout -gt 0 ]; do
        HEALTH_STATUS=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
        EXPECTED_SERVICES=2  # chess-stats and redis
        
        if [ "$HEALTH_STATUS" -eq "$EXPECTED_SERVICES" ]; then
            print_status "All services are running!"
            break
        fi
        
        echo "Waiting for services... ($timeout seconds remaining)"
        echo "Running services: $HEALTH_STATUS/$EXPECTED_SERVICES"
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -eq 0 ]; then
        print_error "Services failed to become healthy within 120 seconds"
        echo "Docker logs:"
        docker-compose logs --tail=50 chess-stats
        rollback
        exit 1
    fi
}

# Rollback function
rollback() {
    print_error "Rolling back deployment..."
    
    # Stop failed containers
    docker-compose down --remove-orphans
    
    # Restart old containers if they exist
    if [ -n "$OLD_CONTAINERS" ]; then
        print_warning "Attempting to restart previous containers..."
        for container in $OLD_CONTAINERS; do
            docker start $container 2>/dev/null || true
        done
    fi
    
    print_warning "Rollback completed. Manual intervention may be required."
}

# Run health checks
health_check() {
    echo "🏥 Running health checks..."
    
    local checks_passed=0
    local total_checks=4
    
    # Check API health
    echo -n "  Checking API health... "
    if curl -f -s http://localhost:3007/health > /dev/null; then
        echo "✅"
        ((checks_passed++))
        
        # Get detailed health info
        HEALTH_INFO=$(curl -s http://localhost:3007/health)
        echo "    API Status: $(echo $HEALTH_INFO | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
    else
        echo "❌"
        print_error "API health check failed"
    fi
    
    # Check Redis
    echo -n "  Checking Redis... "
    if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "✅"
        ((checks_passed++))
    else
        echo "❌"
        print_error "Redis health check failed"
    fi
    
    # Check database connectivity
    echo -n "  Checking database... "
    if curl -s http://localhost:3007/api/stats/overview | grep -q "totalGames"; then
        echo "✅"
        ((checks_passed++))
        
        # Get game count
        GAME_COUNT=$(curl -s http://localhost:3007/api/stats/overview | grep -o '"totalGames":[0-9]*' | cut -d':' -f2)
        echo "    Total games in database: $GAME_COUNT"
    else
        echo "❌"
        print_error "Database connectivity check failed"
    fi
    
    # Check response time
    echo -n "  Checking response time... "
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3007/health)
    if (( $(echo "$RESPONSE_TIME < 1" | bc -l) )); then
        echo "✅ (${RESPONSE_TIME}s)"
        ((checks_passed++))
    else
        echo "⚠️  (${RESPONSE_TIME}s - slow response)"
    fi
    
    echo "Health checks: $checks_passed/$total_checks passed"
    
    if [ $checks_passed -lt $total_checks ]; then
        if [ "$FORCE" != "true" ]; then
            print_error "Not all health checks passed. Use --force to continue anyway."
            exit 1
        else
            print_warning "Continuing despite failed health checks (--force flag)"
        fi
    else
        print_status "All health checks passed!"
    fi
}

# Post-deployment tasks
post_deploy() {
    echo "🔧 Running post-deployment tasks..."
    
    # Clear cache if needed
    echo -n "  Clearing cache... "
    docker-compose exec -T redis redis-cli FLUSHDB > /dev/null 2>&1 || true
    echo "✅"
    
    # Log deployment
    echo -n "  Logging deployment... "
    DEPLOY_LOG="./deployments.log"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployed to $ENVIRONMENT" >> "$DEPLOY_LOG"
    echo "✅"
    
    # Send notification (if configured)
    if [ -n "${SLACK_WEBHOOK:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Chess Stats deployed to $ENVIRONMENT successfully!\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null
        echo "  Notification sent ✅"
    fi
}

# Main deployment flow
main() {
    START_TIME=$(date +%s)
    
    echo "═══════════════════════════════════════════════════"
    echo "🎯 Chess Stats Deployment Script"
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $(date)"
    echo "Options: $([ "$SKIP_TESTS" = "true" ] && echo "--skip-tests ")$([ "$SKIP_BACKUP" = "true" ] && echo "--skip-backup ")$([ "$FORCE" = "true" ] && echo "--force")"
    echo "═══════════════════════════════════════════════════"
    
    check_prerequisites
    run_tests
    create_backup
    deploy
    health_check
    post_deploy
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo "═══════════════════════════════════════════════════"
    print_status "Deployment completed successfully! 🎉"
    echo "⏱️  Deployment time: ${DURATION} seconds"
    echo "📊 API: http://localhost:3007"
    echo "🏥 Health: http://localhost:3007/health"
    echo "📋 Logs: docker-compose logs -f"
    echo "📁 Monitoring: http://localhost:3007/api/metrics"
    echo "═══════════════════════════════════════════════════"
}

# Run deployment
main "$@"