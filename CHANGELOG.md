# Changelog

All notable changes to the CodeLink project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2.1.0] - 2026-10-03

### Added

- **Managed Interactive Terminal**:
  - Full Linux PTY pseudo-terminal execution (`node-pty`) running as host user with complete curses, TUI, ANSI escape codes, and job control support.
  - Independent companion daemon lifecycle (`codelink-terminal`) running as a systemd user unit or background service, decoupled from IDE and client connections.
- **End-to-End Encryption (E2EE)**:
  - Cryptographic session encryption using XChaCha20-Poly1305 AEAD via `libsodium`.
  - Relay payload-blind guarantee: Go Relay service routes encrypted bytes without access to keys, plaintext, or output buffers.
  - Monotonic 64-bit sequence counters per direction preventing replay and reordering attacks.
- **Pairing & Trust Verification**:
  - Out-of-band Short Authentication String (SAS) verification matching 6-character cryptographic fingerprints across host and client.
  - Single-use 6-digit pairing codes with 5-minute expiry and explicit host approval gate.
  - Local paired device store with strict `0600` file permissions and instant revocation (`codelink-terminal revoke <deviceId>`).
- **Transport & Flow Control**:
  - 32 KB maximum frame size limits enforced across Go relay and companion daemon.
  - Thread-safe token bucket rate limiter (100 req/s, burst 200) in Go Relay service.
  - Credit-based sliding window flow control (128 KB high watermark, 64 KB low watermark).
  - Priority message queuing ensuring emergency kills, `Ctrl+C` (`\x03`), and revocations bypass bulk output queues.
  - 1 MB bounded circular ring buffer per session with monotonic offsets and `TERM_GAP` truncation notifications on buffer wraps.
- **Multi-Session Persistence & Modes**:
  - Multi-session tab management supporting up to 8 persistent detached shells.
  - Single-controller enforcement: exactly one client holds write permissions (`Control`), while all other clients are relegated to read-only `Observe`.
  - Observer permission guards rejecting unauthorized keystrokes, resizes, and control commands.
  - 6-hour control idle timeout (Decision E) automatically returning control to `Observe`/detached on inactivity while keeping shells alive.
  - Host Takeover precedence allowing the laptop user to reclaim control at any time via CLI or VS Code.
  - Clean Linux process-tree termination using process group signaling (`process.kill(-pid, 'SIGKILL')`) and recursive child PID inspection (`pgrep -P`).
- **Structured Audit Logging & Session Recording**:
  - Structured append-only audit log at `~/.codelink/terminal-audit.log` (mode `0600`) recording administrative, attachment, and mode transition events.
  - Zero-payload audit guarantee: strictly records lifecycle metadata without logging keystrokes, terminal outputs, or keys.
  - Optional local session recording writing asciinema v2 (`.cast`) format with strict `0600` permissions and prominent security notices.
- **Client Interfaces (Mobile & Web)**:
  - Dedicated `/terminal` screen in Expo React Native mobile app and Cloudflare Pages web export.
  - Multi-session tab bar with live observer counts and session creation/closure buttons.
  - Touch-optimized special-keys bar (`Esc`, `Tab`, sticky `Ctrl`, sticky `Alt`, arrows `↑`/`↓`/`←`/`→`, `PgUp`, `PgDn`, `^C`, `^D`).
  - Multiline paste protection modal intercepting newline-containing pastes with line count, preview, and execution warning.
  - Real-time status badges (`CONTROL MODE`, `OBSERVE MODE`, gap warnings, and reconnection states).
- **VS Code Extension Integration**:
  - Status bar item displaying live active session counts (`$(terminal) CodeLink Terminal: Active (X)`).
  - Terminal Management QuickPick menu (`codelink.terminalMenu`) for host takeover, single-session termination, emergency kill-all, and service toggles.

---

## [2.0.0] - 2026-10-02

### Added

- **Line-Range Diff Commenting**:
  - Interactive file diff viewer on mobile with line-number gutter and range selection.
  - Context attachment mapping selected lines to AI instructions.
- **Voice-to-Prompt Dictation Console**:
  - Mobile speech-to-text dictation with real-time transcript streaming.
  - Prompt draft composer supporting quick insertions and manual edits.
- **Universal Editor Adapter Registry**:
  - Pluggable editor adapters for Continue, Kiro, Cursor, and Google Antigravity.
  - Target file resolution with workspace boundary validation (`resolveTargetFile`) preventing directory traversal attacks.
- **Go Backend Microservices**:
  - `services/auth`: Go HTTP REST service with PostgreSQL repository, RSA laptop key verification, and JWT session issuance.
  - `services/relay`: Go WebSocket service with Redis pub/sub routing and pairing channel isolation.
- **Bi-Directional Diff Synchronization**:
  - High-performance `FileWatcher` in VS Code extension monitoring workspace file edits.
  - `SnapshotEngine` and `PatchEncoder` utilizing `diff-match-patch` for lightweight patch broadcasting.
  - Sequence tracking (`seq`, `fromSeq`, `toSeq`) with automatic snapshot resync on gap detection.

---

## [1.0.0] - 2026-09-15

### Added

- Initial project prototype with basic file synchronization and prompt forwarding from mobile to local development environments.
