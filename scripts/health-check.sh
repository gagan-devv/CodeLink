#!/bin/bash

# CodeLink Health Check Script
# Verifies all services are running correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to check HTTP endpoint
check_http() {
    local url=$1
    curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null
}

# Initialize counters
PASSED=0
FAILED=0
WARNINGS=0

echo ""
print_header "CodeLink Health Check"
echo ""

# Check 1: Node.js version
print_header "Prerequisites"
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 20 ]; then
        print_success "Node.js version: $NODE_VERSION"
        ((PASSED++))
    else
        print_error "Node.js version too old: $NODE_VERSION (requires 20.x or higher)"
        ((FAILED++))
    fi
else
    print_error "Node.js not found"
    ((FAILED++))
fi

# Check 2: npm
NPM_VERSION=$(npm -v 2>/dev/null)
if [ $? -eq 0 ]; then
    print_success "npm version: $NPM_VERSION"
    ((PASSED++))
else
    print_error "npm not found"
    ((FAILED++))
fi

# Check 3: node_modules
if [ -d "node_modules" ]; then
    print_success "Dependencies installed"
    ((PASSED++))
else
    print_warning "Dependencies not installed (run: npm install)"
    ((WARNINGS++))
fi

echo ""
print_header "Services"

# Check 4: Relay Server
if port_in_use 8080; then
    print_success "Relay Server running on port 8080"
    ((PASSED++))
else
    print_error "Relay Server not running on port 8080"
    ((FAILED++))
fi

# Check 5: Mobile Client
if port_in_use 8081; then
    print_success "Mobile Client running on port 8081"
    ((PASSED++))
    
    # Try to access the web interface
    HTTP_CODE=$(check_http "http://localhost:8081")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
        print_success "Mobile Client web interface accessible"
        ((PASSED++))
    else
        print_warning "Mobile Client port open but web interface not responding (HTTP $HTTP_CODE)"
        ((WARNINGS++))
    fi
else
    print_error "Mobile Client not running on port 8081"
    ((FAILED++))
fi

echo ""
print_header "Build Artifacts"

# Check 6: Protocol build
if [ -d "packages/protocol/dist" ]; then
    print_success "Protocol package built"
    ((PASSED++))
else
    print_warning "Protocol package not built (run: cd packages/protocol && npm run build)"
    ((WARNINGS++))
fi

# Check 7: Relay Server build
if [ -d "packages/relay-server/dist" ]; then
    print_success "Relay Server built"
    ((PASSED++))
else
    print_warning "Relay Server not built (run: cd packages/relay-server && npm run build)"
    ((WARNINGS++))
fi

# Check 8: VS Code Extension build
if [ -d "packages/vscode-extension/dist" ]; then
    print_success "VS Code Extension built"
    ((PASSED++))
else
    print_warning "VS Code Extension not built (run: cd packages/vscode-extension && npm run build)"
    ((WARNINGS++))
fi

echo ""
print_header "Logs"

# Check 9: Log files
if [ -d "logs" ]; then
    if [ -f "logs/relay-server.log" ]; then
        LOG_SIZE=$(wc -l < logs/relay-server.log)
        print_success "Relay Server log exists ($LOG_SIZE lines)"
        ((PASSED++))
    else
        print_warning "Relay Server log not found"
        ((WARNINGS++))
    fi
    
    if [ -f "logs/mobile-client.log" ]; then
        LOG_SIZE=$(wc -l < logs/mobile-client.log)
        print_success "Mobile Client log exists ($LOG_SIZE lines)"
        ((PASSED++))
    else
        print_warning "Mobile Client log not found"
        ((WARNINGS++))
    fi
else
    print_warning "Logs directory not found (services may not have been started with dev-all.sh)"
    ((WARNINGS++))
fi

echo ""
print_header "Summary"
echo ""

TOTAL=$((PASSED + FAILED + WARNINGS))
echo "Total Checks: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"

echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_success "All checks passed! System is healthy."
    echo ""
    exit 0
elif [ $FAILED -eq 0 ]; then
    print_warning "System is operational but has warnings."
    echo ""
    echo "Recommendations:"
    if [ ! -d "node_modules" ]; then
        echo "  • Run: npm install"
    fi
    if [ ! -d "packages/protocol/dist" ]; then
        echo "  • Build protocol: cd packages/protocol && npm run build"
    fi
    if [ ! -d "packages/relay-server/dist" ]; then
        echo "  • Build relay server: cd packages/relay-server && npm run build"
    fi
    if [ ! -d "packages/vscode-extension/dist" ]; then
        echo "  • Build VS Code extension: cd packages/vscode-extension && npm run build"
    fi
    echo ""
    exit 0
else
    print_error "System has critical issues."
    echo ""
    echo "Recommendations:"
    if [ $FAILED -gt 0 ]; then
        echo "  • Start services: ./scripts/dev-all.sh"
        echo "  • Check logs: tail -f logs/*.log"
        echo "  • Verify ports are free: ./scripts/stop-all.sh"
    fi
    echo ""
    exit 1
fi
