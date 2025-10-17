#!/bin/bash
set -e  # Exit on error

echo "========================================="
echo "Railway Startup Script"
echo "========================================="
echo ""

# Step 1: Download database if needed
echo "Step 1: Checking/downloading database..."
node download-full-db.js
DOWNLOAD_EXIT=$?
echo "Download script exited with code: $DOWNLOAD_EXIT"
echo ""

# Step 2: Start server
echo "Step 2: Starting server..."
exec node simple-server-pooled.js
