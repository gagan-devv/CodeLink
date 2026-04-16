#!/bin/bash

# CodeLink Local Development Script
# This script starts all packages for local testing in parallel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    if port_in_use "$port"; then
        print_warning "Port $port is in use. Killing existing process..."
        lsof -ti :"$port" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Cleanup function
cleanup() {
    print_info "Shutting down all services..."
    
    # Kill all background jobs
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Kill specific ports if still in use
    kill_port 8080  # Relay server
    kill_port 8081  # Mobile client (Expo)
    
    print_success "All services stopped"
    exit 0
}

# Set up trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 20.x or higher."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm 9.x or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js version must be 20.x or higher. Current version: $(node -v)"
    exit 1
fi

print_success "Prerequisites check passed"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Running npm install..."
    npm install
fi

# Build protocol package first (required by other packages)
print_info "Building protocol package..."
cd packages/protocol
npm run build
cd ../..
print_success "Protocol package built"

# Create log directory
LOG_DIR="logs"
mkdir -p "$LOG_DIR"

print_info "Starting all services..."
print_info "Logs will be saved to ./$LOG_DIR/"
echo ""

# Start relay server
print_info "Starting relay server on port 8080..."
kill_port 8080
cd packages/relay-server
npm run build > ../../"$LOG_DIR"/relay-build.log 2>&1
PORT=8080 npm start > ../../"$LOG_DIR"/relay-server.log 2>&1 &
RELAY_PID=$!
cd ../..
print_success "Relay server started (PID: $RELAY_PID)"
echo "  └─ Logs: ./$LOG_DIR/relay-server.log"
echo ""

# Wait for relay server to start
print_info "Waiting for relay server to be ready..."
sleep 3

# Check if relay server is running
if ! port_in_use 8080; then
    print_error "Relay server failed to start. Check logs at ./$LOG_DIR/relay-server.log"
    exit 1
fi
print_success "Relay server is ready"
echo ""

# Start mobile client
print_info "Starting mobile client (Expo)..."
kill_port 8081
cd packages/mobile-client
npx expo start --web > ../../"$LOG_DIR"/mobile-client.log 2>&1 &
MOBILE_PID=$!
cd ../..
print_success "Mobile client started (PID: $MOBILE_PID)"
echo "  └─ Logs: ./$LOG_DIR/mobile-client.log"
echo ""

# Wait for mobile client to start
print_info "Waiting for mobile client to be ready..."
sleep 5

# Check if mobile client is running
if ! port_in_use 8081; then
    print_error "Mobile client failed to start. Check logs at ./$LOG_DIR/mobile-client.log"
    exit 1
fi
print_success "Mobile client is ready"
echo ""

# Print summary
echo ""
print_success "========================================="
print_success "All services are running!"
print_success "========================================="
echo ""
echo -e "${GREEN}Services:${NC}"
echo "  • Relay Server:   http://localhost:8080"
echo "  • Mobile Client:  http://localhost:8081"
echo ""
echo -e "${GREEN}Logs:${NC}"
echo "  • Relay Server:   ./$LOG_DIR/relay-server.log"
echo "  • Mobile Client:  ./$LOG_DIR/mobile-client.log"
echo ""
echo -e "${YELLOW}VS Code Extension:${NC}"
echo "  • Open VS Code in the workspace root"
echo "  • Press F5 to launch Extension Development Host"
echo "  • The extension will connect to the relay server automatically"
echo ""
echo -e "${YELLOW}Testing the Flow:${NC}"
echo "  1. Open mobile client at http://localhost:8081"
echo "  2. Verify connection status shows 'Connected' (green)"
echo "  3. Open a file in VS Code and make changes"
echo "  4. The diff should appear on the mobile client within 2 seconds"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script running and tail logs
tail -f "$LOG_DIR"/relay-server.log "$LOG_DIR"/mobile-client.log
