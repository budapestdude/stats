#!/bin/bash

# Chess Stats Backup Script
# Creates backups of database and important files

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="chess_stats_backup_$TIMESTAMP"
MAX_BACKUPS=30
REMOTE_BACKUP=${REMOTE_BACKUP:-false}
REMOTE_PATH=${REMOTE_PATH:-""}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
}

# Backup database
backup_database() {
    echo "📦 Backing up database..."
    
    # Main database
    if [ -f "./otb-database/complete-tournaments.db" ]; then
        cp "./otb-database/complete-tournaments.db" "$BACKUP_DIR/$BACKUP_NAME/"
        print_status "Main database backed up"
    else
        print_warning "Main database file not found"
    fi
    
    # Chess stats database
    if [ -f "./chess-stats.db" ]; then
        cp "./chess-stats.db" "$BACKUP_DIR/$BACKUP_NAME/"
        print_status "Chess stats database backed up"
    fi
    
    # Calculate database sizes
    if [ -f "$BACKUP_DIR/$BACKUP_NAME/complete-tournaments.db" ]; then
        DB_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME/complete-tournaments.db" | cut -f1)
        echo "  Database size: $DB_SIZE"
    fi
}

# Backup configuration
backup_config() {
    echo "⚙️  Backing up configuration..."
    
    # Environment files
    if [ -f ".env.production" ]; then
        cp ".env.production" "$BACKUP_DIR/$BACKUP_NAME/"
    fi
    
    # Docker configuration
    cp "docker-compose.yml" "$BACKUP_DIR/$BACKUP_NAME/"
    cp "Dockerfile" "$BACKUP_DIR/$BACKUP_NAME/"
    
    # PM2 configuration
    if [ -f "ecosystem.config.js" ]; then
        cp "ecosystem.config.js" "$BACKUP_DIR/$BACKUP_NAME/"
    fi
    
    # Nginx configuration
    if [ -d "nginx" ]; then
        cp -r "nginx" "$BACKUP_DIR/$BACKUP_NAME/"
    fi
    
    print_status "Configuration backed up"
}

# Backup logs (last 7 days)
backup_logs() {
    echo "📋 Backing up recent logs..."
    
    if [ -d "logs" ]; then
        mkdir -p "$BACKUP_DIR/$BACKUP_NAME/logs"
        find logs -name "*.log" -mtime -7 -exec cp {} "$BACKUP_DIR/$BACKUP_NAME/logs/" \;
        print_status "Logs backed up"
    else
        print_warning "Logs directory not found"
    fi
}

# Create compressed archive
create_archive() {
    echo "🗜️  Creating compressed archive..."
    
    cd "$BACKUP_DIR"
    tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
    rm -rf "$BACKUP_NAME"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)
    print_status "Archive created: $BACKUP_NAME.tar.gz ($SIZE)"
    
    cd - > /dev/null
}

# Cleanup old backups
cleanup_old_backups() {
    echo "🧹 Cleaning up old backups..."
    
    cd "$BACKUP_DIR"
    ls -t chess_stats_backup_*.tar.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -- 2>/dev/null
    
    REMAINING=$(ls -1 chess_stats_backup_*.tar.gz 2>/dev/null | wc -l)
    print_status "Cleanup complete. Keeping $REMAINING most recent backups (max: $MAX_BACKUPS)"
    
    cd - > /dev/null
}

# Upload to remote storage
upload_to_remote() {
    if [ "$REMOTE_BACKUP" = "true" ] && [ -n "$REMOTE_PATH" ]; then
        echo "☁️  Uploading to remote storage..."
        
        if command -v rsync &> /dev/null; then
            rsync -avz "$BACKUP_DIR/$BACKUP_NAME.tar.gz" "$REMOTE_PATH/"
            print_status "Backup uploaded to remote storage"
        elif command -v scp &> /dev/null; then
            scp "$BACKUP_DIR/$BACKUP_NAME.tar.gz" "$REMOTE_PATH/"
            print_status "Backup uploaded to remote storage"
        else
            print_warning "Neither rsync nor scp available for remote backup"
        fi
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Chess Stats Backup: $status\\n$message\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null
    fi
}

# Verify backup integrity
verify_backup() {
    echo "✔️  Verifying backup integrity..."
    
    cd "$BACKUP_DIR"
    
    if tar -tzf "$BACKUP_NAME.tar.gz" > /dev/null 2>&1; then
        print_status "Backup integrity verified"
        return 0
    else
        print_error "Backup integrity check failed!"
        return 1
    fi
    
    cd - > /dev/null
}

# Main backup process
main() {
    echo "═══════════════════════════════════════════════════"
    echo "💾 Chess Stats Backup Script"
    echo "Timestamp: $(date)"
    echo "═══════════════════════════════════════════════════"
    
    # Check available disk space
    AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
    echo "📊 Available disk space: $AVAILABLE_SPACE"
    
    create_backup_dir
    backup_database
    backup_config
    backup_logs
    create_archive
    
    if verify_backup; then
        cleanup_old_backups
        upload_to_remote
        
        echo "═══════════════════════════════════════════════════"
        print_status "Backup completed successfully! 🎉"
        echo "📦 Backup location: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
        
        # Show backup statistics
        BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/chess_stats_backup_*.tar.gz 2>/dev/null | wc -l)
        TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
        echo "📈 Total backups: $BACKUP_COUNT"
        echo "💾 Total backup size: $TOTAL_SIZE"
        echo "═══════════════════════════════════════════════════"
        
        send_notification "✅ Success" "Backup completed: $BACKUP_NAME.tar.gz"
    else
        print_error "Backup failed!"
        send_notification "❌ Failed" "Backup failed for $BACKUP_NAME"
        exit 1
    fi
}

# Run backup
main "$@"