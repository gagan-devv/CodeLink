#!/bin/bash
# Setup script for Git hooks
# Run this script to install pre-commit hooks for the CodeLink project

set -e

echo "🔧 Setting up Git hooks for CodeLink..."
echo ""

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo "❌ Error: .git directory not found. Are you in the repository root?"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy pre-commit hook
echo "📋 Installing pre-commit hook..."
cp .github/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "✅ Pre-commit hook installed"
echo ""

echo "✨ Git hooks setup complete!"
echo ""
echo "The pre-commit hook will now run automatically before each commit."
echo "It will check:"
echo "  - ESLint (code quality)"
echo "  - TypeScript compilation (type safety)"
echo "  - Prettier formatting (code style)"
echo ""
echo "To bypass the hook (not recommended), use: git commit --no-verify"
echo ""
echo "To manually run pre-commit checks: npm run precommit"
