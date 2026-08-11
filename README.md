# 🔗 CodeLink

CodeLink is a premium developer tool that brings AI-assisted coding to your mobile device. Review diffs, track unsaved changes, select line ranges, compose text/voice AI prompts, and securely inject instructions directly into your local AI code editor (Continue, Kiro, Cursor, or Antigravity) — all from your phone, without cloud dependencies or synchronizing repositories.

---

## ✨ Features

- 🎯 **Line-Range Diff Commenting**: Tap/select line ranges directly on mobile code diffs to attach targeted refactoring and code review instructions.
- 🎙️ **Voice-to-Prompt Dictation**: Speech-to-text dictation console with real-time audio transcripts and prompt generation.
- 🔍 **Targeted VS Code Context Focus**: Automatically resolves target files, opens text documents, and highlights line ranges in VS Code before injecting prompts into AI editors.
- 🤖 **Universal Editor Adapter Registry**: Native integration with Continue, Kiro, Cursor, and Antigravity editors using safe VS Code extension APIs.
- 🔒 **Zero-Trust Security**: End-to-end local RSA key pairing, JWT authentication, and session revocation tracking via Go microservices.
- ⚡ **Real-Time WebSocket Sync**: Low-latency bidirectionally synchronized diffs, active cursor tracking, and prompt envelopes.

---

## 🏗️ Architecture Overview

CodeLink is built with a highly secure, modular, and performant monorepo architecture:

```
                  ┌──────────────────────────────┐
                  │      VS Code Extension       │ (TypeScript Host)
                  │  - FileWatcher & Git Diffs   │
                  │  - Editor Adapter Registry  │
                  │  - Line-Range Highlighting   │
                  └──────────────┬───────────────┘
                                 │
                                 │ WebSockets (JWT Auth)
                                 ▼
   ┌──────────────────────────────────────────────────────────┐
   │                  Docker Compose Backend                  │
   │                                                          │
   │   ┌─────────────────────┐      ┌─────────────────────┐   │
   │   │    Auth Service     │◀────▶│    Relay Service    │   │
   │   │       (Go REST)     │      │   (Go WebSocket)    │   │
   │   └──────────┬──────────┘      └──────────┬──────────┘   │
   │              │                            │              │
   │              ▼                            ▼              │
   │      ┌───────────────┐            ┌───────────────┐      │
   │      │  PostgreSQL   │            │  Redis Cache  │      │
   │      └───────────────┘            └───────────────┘      │
   └─────────────────────────────┬────────────────────────────┘
                                 │
                                 │ WebSockets (JWT Auth)
                                 ▼
                  ┌──────────────────────────────┐
                  │        Mobile Client         │ (React Native / Expo)
                  │  - Interactive Diff Viewer   │
                  │  - Line-Range Selection UI   │
                  │  - Voice Dictation Console   │
                  └──────────────────────────────┘
```

### 1. VS Code Extension (`packages/vscode-extension`)

A TypeScript host extension that integrates into your local workspace.

- **Git Integration**: Uses a high-performance `FileWatcher` (debounced) and `SnapshotEngine` to compute differences between current file states and Git `HEAD`.
- **Patch Engine**: Compiles patches using `PatchEncoder` and transmits them as `FILE_PATCH` or `FILE_SNAPSHOT` message envelopes.
- **Context Highlighting**: Resolves target file paths from mobile prompt envelopes, opens documents via `vscode.workspace`, and highlights line ranges (`vscode.Selection`).
- **Editor Adapter Registry**: Detects installed AI editors (Continue, Kiro, Cursor, Antigravity) and safely injects prompts using public VS Code command APIs, with no fragile UI scraping.
- **Authentication**: Generates RSA keys locally via `KeyManager` to securely pair with mobile devices.

### 2. Auth Service (`services/auth`)

A microservice written in Go that acts as the source of truth for identity and trust.

- **Laptop Management**: Stores registered laptop identities and public keys in PostgreSQL.
- **Session Control**: Manages user authentication, pairing requests, and signs secure JWTs using its private key.
- **Revocations**: Coordinates session cancellations and tracks session invalidations in Redis.

### 3. Relay Service (`services/relay`)

A high-throughput WebSocket routing hub built in Go.

- **Secure Routing**: Validates JWT signatures using the Auth Service's public key.
- **Real-Time Delivery**: Acts as a stateful WebSocket tunnel routing prompt commands and code diffs between connected extensions and paired mobile devices.
- **PubSub Integration**: Utilizes Redis for cross-node message distribution and connection tracking.

### 4. Mobile Client (`packages/mobile`)

A modern, native-feeling Expo/React Native application for iOS, Android, and web.

- **QR Pairing**: Scans QR codes generated by the VS Code extension to establish secure pairing.
- **Interactive Diff Viewer**: Displays unified code diffs with line-range selection handles and dirty state indicators.
- **Voice & Text Prompt Console**: Features a console with text input and speech-to-text dictation to send rich prompt instructions directly to desktop AI editors.

### 5. Protocol Package (`packages/protocol`)

A shared TypeScript library containing strongly-typed message envelope contracts (`MessageEnvelope`), JSON codecs, type guards, and payload interfaces (`InjectPromptPayload` with `lineRange`, `selectedCode`, and `source`).

---

## 📂 Project Structure

```
codelink/
├── packages/
│   ├── protocol/          # Shared TypeScript contracts and type guards (Library)
│   ├── vscode-extension/  # VS Code Host Extension & Editor Adapters (TypeScript)
│   ├── mobile/            # Expo React Native App (iOS / Android / Web)
│   └── landing/           # Project marketing landing web app
├── services/
│   ├── auth/              # Identity and Token Issuance Service (Go)
│   └── relay/             # WebSocket Message Routing Hub (Go)
├── infra/
│   ├── docker-compose.yml # Backend dependencies and service orchestration
│   └── .env.example       # Backend environmental variables template
├── scripts/
│   ├── setup-git-hooks.sh # Helper script to install pre-commit git hooks
│   └── README.md          # Comprehensive reference of development scripts
├── tsconfig.base.json     # Base TypeScript compiler directives
├── tsconfig.json          # Solution-style TypeScript compiler targets
└── package.json           # Root workspace configuration
```

---

## 🚀 Local Development Setup

Get the full development environment running locally in three simple steps:

### Step 1: Start Backend Infrastructure

Spin up Postgres, Redis, the Auth service, and the Relay service in Docker:

```bash
# Build and start backing services and microservices
docker compose -f infra/docker-compose.yml up --build
```

_Backends will be available on standard local ports: Auth REST on `8081`, Relay WebSocket on `8082`._

### Step 2: Build Workspace Packages

In a new terminal window, build the shared protocol package and extension:

```bash
# Install workspace dependencies
npm install

# Compile workspace packages
npm run build
```

### Step 3: Run Clients

#### Launch VS Code Extension Development Host

1. Open the repository root folder in VS Code.
2. Press `F5` (or go to **Run and Debug** -> click **Run Extension**).
3. A new "Extension Development Host" VS Code window will launch with CodeLink active.
4. Run `CodeLink: Start Pairing` from the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

#### Launch Mobile Client (Expo)

In another terminal, start the Expo development server:

```bash
cd packages/mobile
npm start
```

_Press `w` to run in your local web browser, `a` for Android Emulator, or `i` for iOS Simulator._

---

## 🧪 Testing & Quality Assurance

CodeLink incorporates comprehensive TypeScript workspace validation, Vitest unit testing, and Go microservice tests:

### TypeScript & Workspace Quality Tools

```bash
# Compile and build typescript packages
npm run build

# Run TS typechecks across all workspaces (protocol, extension, mobile)
npm run typecheck

# Run Vitest protocol unit tests
npm run test

# Run TypeScript linter
npm run lint

# Auto-fix linter issues
npm run lint:fix

# Check code formatting via Prettier
npm run format:check

# Format files matching styling policies
npm run format

# Execute pre-commit check pipeline
npm run precommit
```

### Go Service Quality Tools

```bash
# Run unit tests across auth and relay microservices
npm run test:go

# Run verbose Go tests
npm run test:go:verbose
```

### Git Pre-Commit Hook Integration

Prevent invalid or unformatted changes from entering git by installing the pre-commit hook:

```bash
chmod +x scripts/setup-git-hooks.sh
./scripts/setup-git-hooks.sh
```

_This hook automatically executes `npm run precommit` before every commit, enforcing clean compilation and formatting._

---

## 🚢 Production Deployment

For production deployments, the modular microservices scale independently:

- **Database & Cache**: Deploy managed PostgreSQL and Redis instances.
- **Go Microservices**: Containerize and run behind load balancers with WebSocket-sticky session ingress on Relay.
- **Secrets Management**: Inject `AUTH_HMAC_SECRET`, RSA private keys, and database credentials securely.
- **Mobile Client**: Build native Android/iOS app bundles via Expo EAS (`eas build`), or deploy Web/PWA bundles to CDN endpoints.

---

## 📄 License

CodeLink is open-source software licensed under the [MIT License](LICENSE).
