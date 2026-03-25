#!/bin/bash

# Fix Android Build Issues
# This script cleans caches and reinstalls dependencies to fix React hooks errors

set -e

echo "======================================"
echo "Fixing Android Build Issues"
echo "======================================"
echo ""

# Navigate to mobile-client directory
cd "$(dirname "$0")"

echo "Step 1: Stopping any running Metro bundler..."
pkill -f "react-native" || true
pkill -f "expo" || true
echo "✓ Stopped"
echo ""

echo "Step 2: Cleaning Expo cache..."
rm -rf .expo
echo "✓ Expo cache cleared"
echo ""

echo "Step 3: Cleaning node_modules..."
rm -rf node_modules
echo "✓ node_modules removed"
echo ""

echo "Step 4: Cleaning package-lock.json..."
rm -f package-lock.json
echo "✓ package-lock.json removed"
echo ""

echo "Step 5: Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

echo "Step 6: Clearing Metro bundler cache..."
npx expo start --clear
echo ""

echo "======================================"
echo "Build fix complete!"
echo "======================================"
echo ""
echo "Now run: npm run android"
