#!/bin/bash

# Production deployment script
echo "🚀 Starting production deployment..."

# Set environment variables to disable error overlays
export NODE_ENV=production
export DISABLE_ERROR_OVERLAY=true
export DISABLE_REACT_DEV_OVERLAY=true

# Clean up
echo "🧹 Cleaning up..."
rm -rf .next
rm -rf dist
rm -rf node_modules/.cache

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building application..."
npm run build

# Start the application
echo "🎯 Starting production server..."
npm run start

echo "✅ Deployment complete!" 