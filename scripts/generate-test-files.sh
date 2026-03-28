#!/bin/bash

# Script to generate test files for manual testing
# Usage: ./scripts/generate-test-files.sh

set -e

echo "🧪 Generating test files for manual testing..."

# Test 1: Untracked TypeScript file
echo "📝 Creating untracked TypeScript file..."
cat > test-untracked.ts << 'EOF'
// This is an untracked file for testing
export const untrackedConstant = 'This file is not in Git';

export function untrackedFunction() {
  console.log('Testing untracked file handling');
  return true;
}
EOF
echo "✓ Created test-untracked.ts"

# Test 2: Large file (10,500 lines)
echo "📝 Creating large TypeScript file (10,500 lines)..."
node -e "
const lines = [];
lines.push('// Large file for performance testing');
lines.push('// This file has 10,500 lines');
lines.push('');
for (let i = 0; i < 10500; i++) {
  lines.push(\`export const variable\${i} = \${i}; // Line \${i}\`);
}
require('fs').writeFileSync('test-large.ts', lines.join('\n'));
"
echo "✓ Created test-large.ts (10,500 lines)"

# Test 3: Binary file (dummy PNG header)
echo "📝 Creating binary test file..."
printf '\x89PNG\x0D\x0A\x1A\x0A\x00\x00\x00\x0DIHDR' > test-binary.bin
echo "✓ Created test-binary.bin"

# Test 4: JSON test file
echo "📝 Creating JSON test file..."
cat > test-config.json << 'EOF'
{
  "name": "manual-test-config",
  "version": "1.0.0",
  "description": "Test JSON file for manual testing",
  "settings": {
    "enabled": true,
    "timeout": 5000,
    "retries": 3
  },
  "features": [
    "git-integration",
    "diff-viewing",
    "websocket-communication"
  ]
}
EOF
echo "✓ Created test-config.json"

# Test 5: Markdown test file
echo "📝 Creating Markdown test file..."
cat > test-documentation.md << 'EOF'
# Manual Testing Documentation

This is a test markdown file for manual testing.

## Features to Test

- File change detection
- Git integration
- Diff generation
- WebSocket communication

## Test Scenarios

1. Edit this file
2. Wait for debounce (1 second)
3. Check mobile client for diff
4. Verify orange dot appears (isDirty)
5. Save file and verify orange dot disappears

### Expected Results

The diff should appear on the mobile client within 1-2 seconds.

**Performance metrics:**
- Git operation: < 500ms
- Diff generation: < 200ms
- Total pipeline: < 2000ms
EOF
echo "✓ Created test-documentation.md"

echo ""
echo "✅ Test files generated successfully!"
echo ""
echo "📋 Generated files:"
echo "  - test-untracked.ts (untracked file)"
echo "  - test-large.ts (10,500 lines)"
echo "  - test-binary.bin (binary file)"
echo "  - test-config.json (JSON file)"
echo "  - test-documentation.md (Markdown file)"
echo ""
echo "🔧 Next steps:"
echo "  1. Start relay server: cd packages/relay-server && npm start"
echo "  2. Start mobile client: cd packages/mobile-client && npm run dev"
echo "  3. Press F5 in VS Code to launch Extension Development Host"
echo "  4. Open test files in Extension Development Host and make changes"
echo ""
echo "🧹 To clean up test files later, run:"
echo "  ./scripts/cleanup-test-files.sh"
