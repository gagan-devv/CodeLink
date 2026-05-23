# Development, Quality Control & Orchestration Scripts

Following the **CodeLink V2 Architecture Rewrite**, all manual testing shell scripts have been deprecated and replaced with:

1. **Docker Compose Infrastructure Orchestration** for full-stack local services.
2. **Monorepo-wide NPM Workspace Scripts** for unified TypeScript builds, linting, formatting, and unit tests.
3. **Native Go Tooling** for robust testing and execution of backend microservices.

This guide provides a comprehensive reference of available quality control scripts, commands, and development workflows.

---

## 🛠️ System Prerequisites

To run the local validation and orchestration scripts, ensure the following are installed:

- **Node.js** (v20.x or higher)
- **npm** (v9.x or higher)
- **Go** (v1.21 or higher)
- **Docker & Docker Compose**

---

## 🎛️ Unified NPM Workspace Scripts

The root `package.json` defines monorepo-wide scripts that coordinate tasks across all TypeScript workspaces (`packages/protocol`, `packages/vscode-extension`, and `packages/mobile`) and Go services (`services/auth`, `services/relay`).

### Script Directory Reference

| Command                   | Action                     | Scope / Under the Hood                                                            |
| :------------------------ | :------------------------- | :-------------------------------------------------------------------------------- |
| `npm run build`           | Builds all workspaces      | Runs `npm run build` in all workspaces containing it.                             |
| `npm run lint`            | Lints entire codebase      | Runs ESLint across all `.ts` and `.tsx` files (ignoring `.eslintignore`).         |
| `npm run lint:fix`        | Fixes lint issues          | Runs ESLint with the `--fix` flag on all TypeScript files.                        |
| `npm run format`          | Prettifies codebase        | Re-formats typescript, javascript, JSON, and markdown files using Prettier.       |
| `npm run format:check`    | Verifies formatting        | Validates that files conform to Prettier styling guidelines.                      |
| `npm run typecheck`       | Validates TypeScript types | Runs typecheck sequentially across `protocol`, `vscode`, and `mobile` workspaces. |
| `npm run test`            | Runs JS unit tests         | Executes all Vitest unit tests in a single headless run.                          |
| `npm run test:watch`      | Watch-mode JS tests        | Launches the Vitest test runner in interactive watch mode.                        |
| `npm run test:coverage`   | Generates JS coverage      | Runs Vitest tests and outputs a V8 coverage report to `coverage/`.                |
| `npm run test:go`         | Runs Go unit tests         | Executes unit tests across all Go microservices (`go test ./services/...`).       |
| `npm run test:go:verbose` | Verbose Go testing         | Runs Go unit tests with detailed output (`go test -v ./services/...`).            |
| `npm run precommit`       | Pre-commit sanity check    | Sequentially runs linting, typechecking, and format checks.                       |

---

## 🐳 Backend Service Orchestration (`infra/`)

The core Go services, Postgres database, and Redis cache are orchestratable via Docker Compose located in the `/infra` directory.

### Quick Start Full Backend Services

From the project root, run:

```bash
# Build and start all backend services (Postgres, Redis, Auth Service, Relay Service)
docker compose -f infra/docker-compose.yml up --build
```

### Local Dev Port Map

When spun up, the orchestration layer exposes the following ports on the host system:

- **Auth Service**: `8081` (REST API)
- **Relay Service**: `8082` (WebSocket Hub)
- **Postgres Database**: `5432` (Relational Storage)
- **Redis Cache**: `6379` (In-memory PubSub & Token Caching)

---

## 📦 Component-Specific Development & Scripts

### 1. Shared Protocol (`packages/protocol`)

The protocol package defines typescript contracts and message codecs shared between the extension and mobile clients.

- **Build Output**: Compiles into `dist/`
- **Commands**:
  ```bash
  cd packages/protocol
  npm run build    # Compile TypeScript
  npm run dev      # Watch mode for changes
  npm run test     # Run protocol unit tests
  ```

### 2. VS Code Extension (`packages/vscode-extension`)

Integrates local editors (Continue, Kiro, Cursor, Antigravity) with Git diff streams and WebSocket commands.

- **Build Output**: Compiles extension assets into `dist/extension.js`
- **Commands**:
  ```bash
  cd packages/vscode-extension
  npm run build    # Compile Extension
  npm run dev      # Watch mode (F5 inside VS Code to launch extension debugger host)
  npm run test     # Run extension unit tests
  ```

### 3. Mobile Client (`packages/mobile`)

React Native & Expo PWA client featuring QR pairing, live unified diff views, and AI prompt compositions.

- **Commands**:
  ```bash
  cd packages/mobile
  npm start        # Start Expo developer tool
  npm run android  # Run on connected Android device/emulator
  npm run ios      # Run on connected iOS device/simulator
  npm run web      # Run mobile client inside your web browser
  ```

### 4. Go Microservices (`services/auth` & `services/relay`)

Performance-critical components managing cryptographical keys, session lifecycles, and high-frequency WebSocket relays.

- **Commands**:

  ```bash
  # Run unit tests across both services from root
  npm run test:go

  # Run verbose tests from root
  npm run test:go:verbose

  # Or run tests directly inside a specific service directory:
  cd services/auth && go test -v ./...
  cd services/relay && go test -v ./...
  ```

---

## 🛡️ Code Quality & PR Readiness

To prevent syntax, type, or lint failures in the CI/CD pipeline, run the root pre-commit suite prior to executing git commits:

```bash
# Validates code style, structural types, and formatting
npm run precommit
```

If any format errors are flagged, quickly resolve them by running:

```bash
npm run format
npm run lint:fix
```

---

## 📝 Troubleshooting & Common Development Issues

### 1. `vitest: command not found`

Ensure you have run clean package installation at the root level using the standard legacy flags if needed:

```bash
npm install
```

### 2. Go test failures or dependencies missing

Make sure you are inside a Go workspace setup. Check the `go.work` configuration in the root:

```go
go 1.26.3

use (
	./services/auth
	./services/relay
)
```

Ensure your Go environment is configured correctly, and run `go mod tidy` in the relevant service directories if dependencies are out of sync.

### 3. Docker port conflicts

If `docker compose` fails to bind to ports `8081`, `8082`, `5432`, or `6379`, verify that no local PostgreSQL, Redis, or node servers are already active on your host system:

```bash
# Check if services are already using these ports
sudo lsof -i :5432
sudo lsof -i :6379
```
