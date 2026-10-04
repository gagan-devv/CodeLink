#!/usr/bin/env node
import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import sodium from 'libsodium-wrappers';
import { CompanionConfig } from '../service/CompanionConfig';
import { PtyManager } from '../pty/PtyManager';
import { SessionTable } from '../session/SessionTable';
import { SocketServer, IpcCommand, IpcResponse } from '../ipc/SocketServer';
import { PairingManager, PairingChallenge, KeyPair } from '../crypto/PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import { AuditLogger } from '../audit/AuditLogger';
import { SessionRecorder } from '../recording/SessionRecorder';
import { DaemonRelayManager } from '../transport/DaemonRelayManager';

function getDefaultSocketPath(): string {
  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, 'codelink-terminal.sock');
  }
  return path.join(os.homedir(), '.codelink', 'terminal.sock');
}

function getOrCreateHostKeyPair(): KeyPair {
  const keysPath = path.join(os.homedir(), '.codelink', 'host_identity.json');
  try {
    if (fs.existsSync(keysPath)) {
      const raw = fs.readFileSync(keysPath, 'utf8');
      const data = JSON.parse(raw);
      return {
        keyType: 'x25519',
        publicKey: sodium.from_base64(data.publicKey),
        privateKey: sodium.from_base64(data.privateKey),
      };
    }
  } catch {
    // regenerate
  }

  const dir = path.dirname(keysPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const keys = sodium.crypto_kx_keypair();
  fs.writeFileSync(
    keysPath,
    JSON.stringify(
      {
        publicKey: sodium.to_base64(keys.publicKey),
        privateKey: sodium.to_base64(keys.privateKey),
        createdAt: Date.now(),
      },
      null,
      2
    ),
    { encoding: 'utf8', mode: 0o600 }
  );

  return keys;
}

async function sendIpcCommand(socketPath: string, cmd: IpcCommand): Promise<IpcResponse> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(socketPath)) {
      return reject(new Error('Companion daemon is not running (socket not found).'));
    }

    const client = net.createConnection(socketPath);
    let responseData = '';

    client.on('connect', () => {
      client.write(JSON.stringify(cmd) + '\n');
    });

    client.on('data', (chunk) => {
      responseData += chunk.toString('utf8');
      const lines = responseData.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as IpcResponse;
          client.end();
          return resolve(parsed);
        } catch {
          // continue reading
        }
      }
    });

    client.on('error', (err) => {
      reject(err);
    });

    client.setTimeout(3000, () => {
      client.destroy();
      reject(new Error('IPC command timed out.'));
    });
  });
}

function installSystemdService(): void {
  const systemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
  const servicePath = path.join(systemdDir, 'codelink-terminal.service');
  const nodeBin = process.execPath;
  const scriptPath = path.resolve(__dirname, 'codelink-terminal.js');

  const unitContent = `[Unit]
Description=CodeLink Managed Interactive Terminal Companion Service
After=network.target

[Service]
Type=simple
ExecStart=${nodeBin} ${scriptPath} start-daemon
Restart=on-failure
RestartSec=3s
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;

  try {
    fs.mkdirSync(systemdDir, { recursive: true });
    fs.writeFileSync(servicePath, unitContent, { mode: 0o644 });
    console.log(`[codelink-terminal] Installed systemd user unit to ${servicePath}`);
    console.log(`To start and enable automatically on login:`);
    console.log(`  systemctl --user daemon-reload`);
    console.log(`  systemctl --user enable --now codelink-terminal`);
  } catch (err) {
    console.error(`[codelink-terminal] Failed to install systemd user unit:`, err);
  }
}

async function runDaemon(): Promise<void> {
  await sodium.ready;
  const config = new CompanionConfig();
  const socketPath = getDefaultSocketPath();
  const hostKeys = getOrCreateHostKeyPair();
  const auditLogger = new AuditLogger();
  const sessionRecorder = new SessionRecorder({
    enabled: config.get().recordingEnabled,
  });
  const deviceStore = new PairedDeviceStore(undefined, auditLogger);
  const pairingManager = new PairingManager(hostKeys, deviceStore);
  const ptyManager = new PtyManager();
  const sessionTable = new SessionTable(ptyManager, {
    maxSessions: config.get().maxSessions,
    controlIdleTimeoutMs: 6 * 60 * 60 * 1000,
    auditLogger,
    sessionRecorder,
  });
  sessionTable.startIdleTimer(60000);

  const relayManager = new DaemonRelayManager(
    config,
    sessionTable,
    pairingManager,
    deviceStore,
    hostKeys
  );

  const server = new SocketServer(
    socketPath,
    config,
    sessionTable,
    pairingManager,
    deviceStore,
    auditLogger,
    sessionRecorder,
    relayManager
  );

  console.log(`[codelink-terminal] Starting companion service...`);
  console.log(
    `[codelink-terminal] Feature enabled: ${config.isEnabled() ? 'YES' : 'NO (default OFF)'}`
  );
  console.log(`[codelink-terminal] Socket path: ${socketPath}`);
  console.log(
    `[codelink-terminal] Safety notice: Shells run as ${os.userInfo().username} with full file access.`
  );
  if (config.get().recordingEnabled) {
    console.warn(
      `[codelink-terminal] WARNING: Local session recording is enabled. Terminal outputs will be recorded to disk.`
    );
  }

  await server.start();
  console.log(`[codelink-terminal] Companion daemon running and listening for local commands.`);

  // Auto-attach if active session and identity exist
  if (config.isEnabled()) {
    relayManager.autoAttachIfAvailable().catch((err) => {
      console.warn('[codelink-terminal] Could not auto-attach to session:', err.message);
    });
  }

  const shutdown = async () => {
    console.log('\n[codelink-terminal] Shutting down companion service...');
    await relayManager.shutdown();
    sessionTable.stopIdleTimer();
    await sessionTable.closeAll();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main(): Promise<void> {
  await sodium.ready;
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const socketPath = getDefaultSocketPath();

  switch (command) {
    case 'start-daemon': {
      await runDaemon();
      break;
    }

    case 'status': {
      const config = new CompanionConfig();
      console.log('--- CodeLink Terminal Companion Status ---');
      console.log(`Feature Config: ${config.isEnabled() ? 'ENABLED' : 'DISABLED (default OFF)'}`);
      console.log(`Max Sessions: ${config.get().maxSessions}`);
      console.log(
        `Recording: ${config.get().recordingEnabled ? 'ENABLED' : 'DISABLED (default OFF)'}`
      );
      console.log(`Socket path: ${socketPath}`);

      try {
        const res = await sendIpcCommand(socketPath, { command: 'status' });
        if (res.ok) {
          const d = res.data as { activeSessions: number; uptimeSeconds: number };
          console.log(`Daemon Status: RUNNING (uptime: ${d.uptimeSeconds}s)`);
          console.log(`Active Sessions: ${d.activeSessions}`);
        }
      } catch {
        console.log(`Daemon Status: NOT RUNNING`);
      }
      break;
    }

    case 'pair': {
      try {
        const res = await sendIpcCommand(socketPath, { command: 'pair' });
        if (res.ok) {
          const challenge = res.data as PairingChallenge;
          console.log('\n=== CodeLink Terminal Device Pairing ===');
          console.log(`Pairing Code:          ${challenge.code} (valid for 5 minutes)`);
          console.log(`Host Key Fingerprint:  ${challenge.fingerprint}`);
          console.log('\nSafety Warning:');
          console.log(
            `  The paired client will have full access to your files and execute commands as '${os.userInfo().username}'.`
          );
          console.log(
            '  Verify that the Short Authentication String (SAS) matches on both devices before approving.'
          );
        } else {
          console.error('Pairing error:', res.error);
        }
      } catch (err) {
        console.error('Could not initiate pairing with companion daemon:', err);
      }
      break;
    }

    case 'devices': {
      try {
        const res = await sendIpcCommand(socketPath, { command: 'list-devices' });
        if (res.ok) {
          console.log('Paired Devices:', JSON.stringify(res.data, null, 2));
        } else {
          console.error('Failed to list devices:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    case 'revoke': {
      const deviceId = args[1];
      if (!deviceId) {
        console.error('Usage: codelink-terminal revoke <deviceId>');
        process.exit(1);
      }
      try {
        const res = await sendIpcCommand(socketPath, { command: 'revoke', args: { deviceId } });
        if (res.ok) {
          console.log(`✓ Device ${deviceId} has been revoked.`);
        } else {
          console.error('Failed to revoke device:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    case 'enable': {
      const config = new CompanionConfig();
      config.setEnabled(true);
      console.log('✓ CodeLink Terminal feature ENABLED on this host.');
      try {
        await sendIpcCommand(socketPath, { command: 'enable' });
      } catch {
        // daemon not running yet
      }
      installSystemdService();
      break;
    }

    case 'disable': {
      const config = new CompanionConfig();
      config.setEnabled(false);
      console.log('✓ CodeLink Terminal feature DISABLED on this host.');
      try {
        await sendIpcCommand(socketPath, { command: 'disable' });
      } catch {
        // daemon not running
      }
      break;
    }

    case 'kill-all': {
      try {
        const res = await sendIpcCommand(socketPath, { command: 'kill-all' });
        if (res.ok) {
          console.log('✓ All active terminal sessions and processes have been terminated.');
        } else {
          console.error('Failed to kill sessions:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    case 'kill': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: codelink-terminal kill <sessionId>');
        process.exit(1);
      }
      try {
        const res = await sendIpcCommand(socketPath, {
          command: 'kill-session',
          args: { sessionId },
        });
        if (res.ok) {
          console.log(`✓ Terminal session ${sessionId} has been terminated.`);
        } else {
          console.error('Failed to kill session:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    case 'takeover': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: codelink-terminal takeover <sessionId>');
        process.exit(1);
      }
      try {
        const res = await sendIpcCommand(socketPath, {
          command: 'takeover',
          args: { sessionId },
        });
        if (res.ok) {
          console.log(`✓ Host reclaimed control of session ${sessionId}.`);
        } else {
          console.error('Failed to reclaim control:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    case 'audit': {
      const limit = parseInt(args[1] || '20', 10);
      try {
        const res = await sendIpcCommand(socketPath, {
          command: 'audit',
          args: { limit },
        });
        if (res.ok) {
          const events = ((res.data as Record<string, unknown>)?.events as unknown[]) || [];
          console.log(`--- Recent Audit Events (${events.length}) ---`);
          for (const ev of events as Array<Record<string, unknown>>) {
            const time = new Date(Number(ev.timestamp)).toISOString();
            console.log(`[${time}] ${String(ev.type).toUpperCase()}: ${JSON.stringify(ev)}`);
          }
        } else {
          console.error('Failed to fetch audit log:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    case 'attach': {
      const sessionId = args[1];
      if (!sessionId) {
        console.error('Usage: codelink-terminal attach <sessionId> [relayUrl] [authUrl]');
        process.exit(1);
      }
      const relayWssUrl = args[2];
      const authUrl = args[3];
      try {
        const res = await sendIpcCommand(socketPath, {
          command: 'attach-session',
          args: { sessionId, relayWssUrl, authUrl },
        });
        if (res.ok) {
          console.log(`✓ Attached to session ${sessionId}.`);
        } else {
          console.error('Failed to attach session:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    case 'detach': {
      try {
        const res = await sendIpcCommand(socketPath, { command: 'detach-session' });
        if (res.ok) {
          console.log('✓ Detached active session.');
        } else {
          console.error('Failed to detach session:', res.error);
        }
      } catch (err) {
        console.error('Could not communicate with companion daemon:', err);
      }
      break;
    }

    default: {
      console.log(`Usage: codelink-terminal <command>

Commands:
  status         Show companion status, configuration, and active sessions
  enable         Enable remote terminal capability and configure systemd service
  disable        Disable remote terminal capability and close all sessions
  attach <id>    Attach companion daemon to an active session
  detach         Detach companion daemon from active session
  pair           Generate a one-time pairing code and QR data for a new device
  devices        List all paired remote devices
  revoke <id>    Revoke an approved paired device
  kill <id>      Emergency kill-switch: terminate a specific active session
  kill-all       Emergency kill-switch: terminate all active terminal sessions
  takeover <id>  Reclaim control of a session back to the local host
  audit [limit]  Display recent structured audit log records
  list           List all active terminal sessions
  start-daemon   Run companion daemon in foreground (for systemd or testing)

Safety Model:
  The shell runs with your OS user privileges (${os.userInfo().username}) and full access to your files.
  Remote access is default OFF and requires explicit opt-in.
`);
      break;
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
}
