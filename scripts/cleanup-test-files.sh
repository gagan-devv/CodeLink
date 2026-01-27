#!/bin/bash

# Script to clean up test files after manual testing
# Usage: ./scripts/cleanup-test-files.sh

set -e

echo "🧹 Cleaning up test files..."

# List of test files to remove
TEST_FILES=(
  "test-untracked.ts"
  "test-added.ts"
  "test-large.ts"
  "test-binary.bin"
  "test-image.png"
  "test-config.json"
  "test-documentation.md"
)

REMOVED_COUNT=0

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "✓ Removed $file"
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
  fi
done

# Also remove from Git if they were added
echo ""
echo "🔍 Checking Git status..."
git status --short | grep "^??" | awk '{print $2}' | while read -r file; do
  if [[ "$file" == test-* ]]; then
    echo "  Found untracked test file: $file"
  fi
done

echo ""
if [ $REMOVED_COUNT -eq 0 ]; then
  echo "✅ No test files found to clean up"
else
  echo "✅ Cleaned up $REMOVED_COUNT test file(s)"
fi

echo ""
echo "💡 If you committed any test files, run:"
echo "   git reset HEAD test-*.ts test-*.json test-*.md test-*.bin"
echo "   git checkout -- test-*.ts test-*.json test-*.md test-*.bin"
