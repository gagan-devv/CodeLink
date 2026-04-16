#!/bin/bash

# CodeLink Stop All Services Script
# Kills all running CodeLink services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    local service=$2
    
    if port_in_use "$port"; then
        print_info "Stopping $service on port $port..."
        lsof -ti :"$port" | xargs kill -9 2>/dev/null || true
        sleep 1
        
        if port_in_use "$port"; then
            echo -e "${RED}[ERROR]${NC} Failed to stop $service on port $port"
            return 1
        else
            print_success "$service stopped"
            return 0
        fi
    else
        print_info "$service is not running on port $port"
        return 0
    fi
}

echo ""
print_info "Stopping all CodeLink services..."
echo ""

# Stop relay server (port 8080)
kill_port 8080 "Relay Server"

# Stop mobile client (port 8081)
kill_port 8081 "Mobile Client (Expo)"

# Kill any remaining node processes related to CodeLink
print_info "Cleaning up remaining processes..."
pkill -f "relay-server" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true

echo ""
print_success "All services stopped"
echo ""
