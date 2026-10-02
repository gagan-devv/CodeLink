# Staging & Deployment Guidelines

## Overview

The `staging` branch is the designated deployment branch for CodeLink. All live staging and preview deployments (backend services and mobile builds) are triggered exclusively from this branch.

---

## Architecture & Deployment Mapping

| Target                   | Deployment Platform             | Trigger Branch | Profile / Env                |
| :----------------------- | :------------------------------ | :------------- | :--------------------------- |
| **Auth Service**         | Railway                         | `staging`      | Staging / Preview DB & Redis |
| **Relay Service**        | Railway                         | `staging`      | Staging / Preview Redis      |
| **Mobile App (Android)** | Expo Application Services (EAS) | `staging`      | `preview` (APK)              |

---

## Staging Branch Rules

### 1. No Direct Pushes

Direct commits or direct pushes (`git push origin staging`) are prohibited. All updates must be delivered through Pull Requests (PRs) from topic branches (e.g. `feat/*`, `fix/*`, `chore/*`).

### 2. Mandatory CI Verification

Before merging any PR into `staging`, the GitHub Actions CI pipeline (`Lint, Type Check, and Test`) must pass completely:

- TypeScript typecheck across `@codelink/protocol`, `packages/vscode-extension`, and `packages/mobile`.
- ESLint code quality checks.
- Prettier code style formatting checks.
- Vitest unit & integration tests (`@codelink/protocol`, `packages/vscode-extension`).
- Go unit & race tests (`services/auth`, `services/relay`).

### 3. Branch Protection

- **No Force Pushes**: `git push --force` is disabled to prevent history rewriting.
- **No Branch Deletion**: The `staging` branch is permanent and cannot be deleted.
- **Linear / Clean History**: Squash merge or clean merge commits are enforced to keep release tracking clear.

### 4. Promotion to Production (`main`)

After end-to-end verification on the `staging` deployment:

1. Open a PR from `staging` into `main`.
2. Ensure release notes and tags are assigned.
3. Merge into `main` for official release tagging.
