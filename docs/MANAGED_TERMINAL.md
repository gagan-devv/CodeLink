# CodeLink Managed Interactive Terminal

## 1. Overview & Architecture

The **CodeLink Managed Interactive Terminal** provides secure, remote mobile and web access to a real, interactive Linux pseudoterminal (PTY) running directly as your host user on your local laptop.

Unlike basic command runners, this is a stateful, interactive terminal supporting full curses/TUI applications (such as `vim`, `htop`, `tmux`, and `nano`), job control, ANSI escapes, multi-tab sessions, and persistent detached shell execution that survives mobile connection drops and IDE restarts.

```
┌────────────────────────────────┐
│   Remote Client (Mobile / Web)  │
│   - Multi-tab Session UI       │
│   - Touch Special-Keys Bar     │
│   - Multiline Paste Safeguard  │
│   - Decrypts & Renders PTY     │
└───────────────▲────────────────┘
                │
                │ Encrypted frames (XChaCha20-Poly1305)
                ▼
┌────────────────────────────────┐
│      Relay Service (Go)        │
│   - Payload-Blind Blind Router │
│   - 32 KB Frame Size Limit     │
│   - Token Bucket Rate Limiter  │
└───────────────▲────────────────┘
                │
                │ Encrypted frames (XChaCha20-Poly1305)
                ▼
┌────────────────────────────────┐
│   Host Companion Daemon (Node) │
│   - PTY Manager (node-pty)     │
│   - 1 MB Ring Buffer / Session │
│   - Process-Tree Cleanup       │
│   - Single-Controller Guard    │
│   - 6-Hour Idle Timeout        │
│   - Structured Audit Log (0600)│
│   - Local Unix Socket (0600)   │
└───────────────▲────────────────┘
                │ Unix Domain Socket IPC
                ▼
┌────────────────────────────────┐
│ VS Code Host Controls & Status │
│   - Status Bar Session Counter │
│   - Host Takeover Action       │
│   - Emergency Kill Switch      │
└────────────────────────────────┘
```

---

## 2. Threat Model & Safety Guarantees

### Honest Safety Model: Full Host Privileges

- **No False Claims**: A full interactive PTY possesses the exact permissions and privileges of the host OS user (`$USER`).
- We do **not** claim to provide sandboxing, command whitelisting, or workspace isolation for interactive shells. If an approved client sends `rm -rf /`, the host operating system will execute it according to the host user's permissions.
- **Default OFF**: Remote terminal execution is **strictly disabled by default** on all hosts. To enable access, you must explicitly run `codelink-terminal enable`.

### End-to-End Encryption (E2EE) & Relay Blindness

- All terminal inputs, keystrokes, and outputs are encrypted end-to-end between the remote device and the local host companion daemon using **XChaCha20-Poly1305 AEAD** via `libsodium`.
- **Relay Opacity**: The Relay Service acts as an oblivious transport router. It never possesses the session keys, cannot decrypt terminal traffic, and does not buffer terminal plaintext.

### Anti-Replay, Sequencing, & Frame Limits

- Every encrypted frame includes a monotonically incrementing 64-bit sequence counter.
- Replayed, out-of-order, or tampered frames are rejected by libsodium AEAD authentication.
- All frames are strictly capped at **32 KB** by both the Relay service and the Companion daemon, preventing memory-exhaustion DoS attacks.
- A thread-safe token bucket rate limiter (100 req/sec, burst 200) protects against client or relay flooding.

### Flow Control & Bounded Buffers

- Each terminal session is allocated a bounded **1 MB circular ring buffer**.
- Output streaming utilizes high/low watermark credit-based flow control (high watermark: 128 KB, low watermark: 64 KB).
- High-priority control messages (such as `Ctrl+C` `\x03`, emergency kill, and revocation) jump ahead of bulk output queues.
- If a client disconnects and misses more than the 1 MB buffer capacity, the companion sends an explicit `TERM_GAP` notice alerting the client that lines were truncated.

---

## 3. Device Pairing & Authorization

Remote access requires mutual cryptographic authorization:

1. **Pairing Initiation**:
   On the host laptop, run:

   ```bash
   codelink-terminal pair
   ```

   This generates a single-use 6-digit code with a 5-minute expiration and displays the host's public key fingerprint.

2. **Short Authentication String (SAS) Verification**:
   The companion daemon computes a deterministic 6-character Short Authentication String derived from `HostPubKey || ClientPubKey || Code`. The same SAS is displayed on the mobile/web client. You must visually verify that both strings match.

3. **Explicit Host Approval**:
   The device is only granted access after explicit confirmation on the laptop. Approved devices are stored with mode `0600` in `~/.codelink/paired_devices.json`.

4. **Instant Revocation**:
   Any paired device can be immediately revoked at any time:
   ```bash
   codelink-terminal revoke <deviceId>
   ```

---

## 4. Session Modes, Idle Timeout & Kill Switches

### Single-Controller Enforcement

- Exactly **one device** may hold `Control` mode over a session at any given time.
- Any other connected devices are assigned `Observe` mode (read-only).
- Observer write attempts (keystrokes, resizing, or control sequences) are dropped, produce an authorization error, and trigger an audit log entry.

### Host Takeover

- The local laptop user always has absolute precedence.
- If a remote device has control, the laptop user can reclaim control instantly:
  - From the terminal CLI: `codelink-terminal takeover <sessionId>`
  - From VS Code: click the status bar item -> **Reclaim Control (Host Takeover)**
- The remote device is immediately demoted to `Observe` mode.

### 6-Hour Control Idle Timeout (Decision E)

- If a remote device holding `Control` remains idle with no user input for **6 continuous hours**, control is automatically revoked back to `Observe` / detached.
- The underlying PTY shell, background processes, and ring buffer remain active (up to the maximum 8-session limit).

### Emergency Kill Switch & Process-Tree Cleanup

- Terminating a session kills the entire Linux process tree. Background jobs (`sleep 100 &`, nested subshells, etc.) are discovered via child PID inspection (`pgrep -P`) and process group signaling (`process.kill(-pid, 'SIGKILL')`).
- Kill commands:
  - Kill single session: `codelink-terminal kill <sessionId>`
  - Kill all sessions: `codelink-terminal kill-all`
  - From VS Code: click status bar -> **Kill Terminal Session** or **Emergency Kill All Sessions**

---

## 5. Audit Logging & Session Recording

### Structured Audit Log

- Location: `~/.codelink/terminal-audit.log` (mode `0600`, directory mode `0700`).
- Append-only structured JSON-lines.
- Records administrative and lifecycle events:
  - `device_paired`, `device_revoked`
  - `session_created`, `session_terminated`
  - `device_attached`, `device_detached`
  - `mode_transition`, `host_takeover`
  - `emergency_kill`, `idle_timeout`
  - `unauthorized_write_attempt`
- **Zero-Payload Guarantee**: The audit log **never** records terminal keystrokes, stdout/stderr payloads, or cryptographic key material.
- View recent audit events:
  ```bash
  codelink-terminal audit 50
  ```

### Optional Local Session Recording

- **Default OFF**.
- When enabled via companion configuration (`recordingEnabled: true`), session outputs are saved in standard asciinema v2 format (`.cast`) in `~/.codelink/recordings/` with strict `0600` permissions.
- Whenever enabled, the companion daemon logs a prominent security warning:
  `"WARNING: Local session recording is enabled. Recordings may capture passwords, API keys, and sensitive data printed in the terminal."`

---

## 6. Client Interface & Safeguards

### Mobile & Web UI Features

- **Multi-Tab Sessions**: Switch between active shells, view observer counts, spawn new tabs (+), or close existing tabs.
- **Special-Keys Touch Bar**: Access `Esc`, `Tab`, sticky `Ctrl`, sticky `Alt`, directional arrows (`↑`, `↓`, `←`, `→`), `PgUp`, `PgDn`, `^C`, and `^D`.
- **Multiline Paste Confirmation Modal**:
  - Automatically intercepts pasted text containing newlines.
  - Displays line count and content preview.
  - Displays a warning that multiline paste will immediately execute commands with host user privileges.
  - Requires explicit confirmation ("Paste Anyway") or cancellation.
- **Status Badges**:
  - `CONTROL MODE` (green indicator, full PTY interaction enabled).
  - `OBSERVE MODE` (yellow indicator, read-only stream).
  - `Reconnecting...` indicator during network transitions.
  - Gap notification banner when output buffers overflow.

---

## 7. CLI Reference & Systemd Service

```bash
codelink-terminal <command>

Commands:
  status         Show companion status, configuration, and active sessions
  enable         Enable remote terminal capability and configure systemd service
  disable        Disable remote terminal capability and terminate all sessions
  pair           Generate a one-time pairing code and QR data for a new device
  devices        List all paired remote devices
  revoke <id>    Revoke an approved paired device
  kill <id>      Emergency kill-switch: terminate a specific active session
  kill-all       Emergency kill-switch: terminate all active terminal sessions
  takeover <id>  Reclaim control of a session back to the local host
  audit [limit]  Display recent structured audit log records
  list           List all active terminal sessions
  start-daemon   Run companion daemon in foreground (for testing or debugging)
```

### Running as a Persistent Systemd User Service

Running `codelink-terminal enable` installs a systemd user unit to `~/.config/systemd/user/codelink-terminal.service`.

To manage the service via systemd:

```bash
# Reload user units
systemctl --user daemon-reload

# Start and enable on boot/login
systemctl --user enable --now codelink-terminal

# Check service logs
journalctl --user -u codelink-terminal -f
```
