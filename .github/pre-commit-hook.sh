#!/bin/bash
# Pre-commit hook for CodeLink
# This script runs linting, type checking, and formatting checks before allowing commits
#
# To install this hook, run:
#   cp .github/pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

set -e

echo "🔍 Running pre-commit checks..."
echo ""

# Run ESLint
echo "📝 Running ESLint..."
npm run lint
echo "✅ ESLint passed"
echo ""

# Run TypeScript checks
echo "🔧 Running TypeScript checks..."
npm run typecheck
echo "✅ TypeScript checks passed"
echo ""

# Check code formatting
echo "💅 Checking code formatting..."
npm run format:check
echo "✅ Code formatting is correct"
echo ""

echo "✨ All pre-commit checks passed! Proceeding with commit..."
