#!/bin/bash

# Ensure we are in the repository root
cd "$(dirname "$0")/.."

# Determine the correct git hooks directory (especially in worktrees)
HOOKS_DIR=$(git rev-parse --git-path hooks 2>/dev/null)

if [ -z "$HOOKS_DIR" ]; then
  # Fallback to standard .git/hooks if git command fails
  HOOKS_DIR=".git/hooks"
fi

HOOK_FILE="$HOOKS_DIR/pre-commit"

echo "Setting up CodeLink pre-commit git hook in $HOOKS_DIR..."

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Write the hook script
cat << 'EOF' > "$HOOK_FILE"
#!/bin/bash

echo "Running pre-commit hooks (lint, typecheck, format check)..."

# Run precommit command
npm run precommit

RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo "❌ Pre-commit checks failed! Please fix the errors before committing."
  exit 1
fi

echo "✅ Pre-commit checks passed!"
exit 0
EOF

# Make it executable
chmod +x "$HOOK_FILE"

echo "✅ Pre-commit git hook successfully installed!"
