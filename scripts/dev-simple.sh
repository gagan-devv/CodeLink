#!/bin/bash

# Simple CodeLink Development Script
# Starts all services using npm workspaces

set -e

echo "🚀 Starting CodeLink development environment..."
echo ""

# Build protocol first
echo "📦 Building protocol package..."
cd packages/protocol && npm run build && cd ../..

# Build relay server
echo "🔧 Building relay server..."
cd packages/relay-server && npm run build && cd ../..

echo ""
echo "✅ Build complete!"
echo ""
echo "Starting services:"
echo "  • Relay Server: http://localhost:8080"
echo "  • Mobile Client: http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start relay server in background
cd packages/relay-server
PORT=8080 npm start &
RELAY_PID=$!
cd ../..

# Give relay server time to start
sleep 2

# Start mobile client
cd packages/mobile-client
npx expo start --web &
MOBILE_PID=$!
cd ../..

# Wait for both processes
wait $RELAY_PID $MOBILE_PID
