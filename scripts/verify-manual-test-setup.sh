#!/bin/bash

# Script to verify manual testing setup is complete
# Usage: ./scripts/verify-manual-test-setup.sh

set -e

echo "🔍 Verifying manual testing setup..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check file exists
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
  else
    echo -e "${RED}✗${NC} $1 (missing)"
    ERRORS=$((ERRORS + 1))
  fi
}

# Function to check directory exists
check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
  else
    echo -e "${RED}✗${NC} $1/ (missing)"
    ERRORS=$((ERRORS + 1))
  fi
}

# Function to check command exists
check_command() {
  if command -v "$1" &> /dev/null; then
    VERSION=$($1 --version 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} $1 ($VERSION)"
  else
    echo -e "${RED}✗${NC} $1 (not installed)"
    ERRORS=$((ERRORS + 1))
  fi
}

# Check documentation files
echo "📚 Checking documentation files..."
check_file "MANUAL_TESTING_GUIDE.md"
check_file "MANUAL_TEST_CHECKLIST.md"
check_file "MANUAL_TEST_EXECUTION.md"
check_file "MANUAL_TEST_SUMMARY.md"
echo ""

# Check script files
echo "🔧 Checking script files..."
check_file "scripts/generate-test-files.sh"
check_file "scripts/cleanup-test-files.sh"
check_file "scripts/verify-manual-test-setup.sh"

# Check if scripts are executable
if [ -x "scripts/generate-test-files.sh" ]; then
  echo -e "${GREEN}✓${NC} generate-test-files.sh is executable"
else
  echo -e "${YELLOW}⚠${NC} generate-test-files.sh is not executable (run: chmod +x scripts/*.sh)"
  WARNINGS=$((WARNINGS + 1))
fi

if [ -x "scripts/cleanup-test-files.sh" ]; then
  echo -e "${GREEN}✓${NC} cleanup-test-files.sh is executable"
else
  echo -e "${YELLOW}⚠${NC} cleanup-test-files.sh is not executable (run: chmod +x scripts/*.sh)"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check package directories
echo "📦 Checking package directories..."
check_dir "packages/protocol"
check_dir "packages/relay-server"
check_dir "packages/vscode-extension"
check_dir "packages/mobile-client"
echo ""

# Check build outputs
echo "🏗️  Checking build outputs..."
check_dir "packages/protocol/dist"
check_dir "packages/relay-server/dist"
check_dir "packages/vscode-extension/dist"
check_dir "packages/mobile-client/dist"
echo ""

# Check key source files
echo "📝 Checking key source files..."
check_file "packages/vscode-extension/src/extension.ts"
check_file "packages/vscode-extension/src/watcher/FileWatcher.ts"
check_file "packages/vscode-extension/src/git/GitIntegrationModule.ts"
check_file "packages/vscode-extension/src/diff/DiffGenerator.ts"
check_file "packages/vscode-extension/src/websocket/WebSocketClient.ts"
check_file "packages/relay-server/src/index.ts"
check_file "packages/mobile-client/src/App.tsx"
check_file "packages/mobile-client/src/components/DiffViewer.tsx"
check_file "packages/mobile-client/src/websocket/WebSocketClient.ts"
check_file "packages/protocol/src/index.ts"
echo ""

# Check VS Code configuration
echo "🔧 Checking VS Code configuration..."
check_file ".vscode/launch.json"
echo ""

# Check required commands
echo "💻 Checking required commands..."
check_command "node"
check_command "npm"
check_command "git"
echo ""

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
  echo -e "${GREEN}✓${NC} Node.js version is 20.x or higher"
else
  echo -e "${RED}✗${NC} Node.js version is below 20.x (current: $(node --version))"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check if packages are built
echo "🏗️  Checking if packages are built..."
if [ -f "packages/protocol/dist/index.js" ]; then
  echo -e "${GREEN}✓${NC} Protocol package is built"
else
  echo -e "${YELLOW}⚠${NC} Protocol package not built (run: npm run build)"
  WARNINGS=$((WARNINGS + 1))
fi

if [ -f "packages/relay-server/dist/index.js" ]; then
  echo -e "${GREEN}✓${NC} Relay server package is built"
else
  echo -e "${YELLOW}⚠${NC} Relay server package not built (run: npm run build)"
  WARNINGS=$((WARNINGS + 1))
fi

if [ -f "packages/vscode-extension/dist/extension.js" ]; then
  echo -e "${GREEN}✓${NC} VS Code extension package is built"
else
  echo -e "${YELLOW}⚠${NC} VS Code extension package not built (run: npm run build)"
  WARNINGS=$((WARNINGS + 1))
fi

if [ -f "packages/mobile-client/dist/index.html" ]; then
  echo -e "${GREEN}✓${NC} Mobile client package is built"
else
  echo -e "${YELLOW}⚠${NC} Mobile client package not built (run: npm run build)"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check Git repository
echo "🔍 Checking Git repository..."
if git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Git repository initialized"
  
  # Check if there are commits
  if git log -1 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Git repository has commits"
  else
    echo -e "${YELLOW}⚠${NC} Git repository has no commits (some tests may not work)"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}✗${NC} Not a Git repository"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo "🚀 Ready to start manual testing!"
  echo ""
  echo "Next steps:"
  echo "  1. Generate test files: ./scripts/generate-test-files.sh"
  echo "  2. Start relay server: cd packages/relay-server && npm start"
  echo "  3. Start mobile client: cd packages/mobile-client && npm run dev"
  echo "  4. Press F5 in VS Code to launch Extension Development Host"
  echo "  5. Follow MANUAL_TEST_EXECUTION.md for testing procedures"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
  echo ""
  echo "You can proceed with manual testing, but some features may not work optimally."
  echo "Review the warnings above and fix them if needed."
  exit 0
else
  echo -e "${RED}✗ $ERRORS error(s) found${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
  fi
  echo ""
  echo "Please fix the errors above before proceeding with manual testing."
  echo ""
  echo "Common fixes:"
  echo "  - Run: npm run build"
  echo "  - Run: chmod +x scripts/*.sh"
  echo "  - Install Node.js 20.x or higher"
  echo "  - Initialize Git repository: git init"
  exit 1
fi
