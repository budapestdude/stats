#!/bin/sh
# Use /bin/sh instead of /bin/bash (Alpine Linux doesn't have bash by default)

echo "========================================="
echo "Railway Startup Script (using sh)"
echo "========================================="
echo ""
echo "Current directory: $(pwd)"
echo "User: $(whoami)"
echo "Node version: $(node --version)"
echo ""

# Step 1: Download database if needed
echo "Step 1: Checking/downloading database..."
node download-full-db.js
DOWNLOAD_EXIT=$?
echo "Download script exited with code: $DOWNLOAD_EXIT"
echo ""

# Step 2: Start server
echo "Step 2: Starting server..."
echo "Executing: node simple-server-pooled.js"
exec node simple-server-pooled.js
