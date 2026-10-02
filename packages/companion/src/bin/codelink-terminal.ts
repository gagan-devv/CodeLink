#!/usr/bin/env node
import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { CompanionConfig } from '../service/CompanionConfig';
import { PtyManager } from '../pty/PtyManager';
import { SessionTable } from '../session/SessionTable';
import { SocketServer, IpcCommand, IpcResponse } from '../ipc/SocketServer';

function getDefaultSocketPath(): string {
  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, 'codelink-terminal.sock');
  }
  return path.join(os.homedir(), '.codelink', 'terminal.sock');
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
  const config = new CompanionConfig();
  const socketPath = getDefaultSocketPath();
  const ptyManager = new PtyManager();
  const sessionTable = new SessionTable(ptyManager, config.get().maxSessions);
  const server = new SocketServer(socketPath, config, sessionTable);

  console.log(`[codelink-terminal] Starting companion service...`);
  console.log(
    `[codelink-terminal] Feature enabled: ${config.isEnabled() ? 'YES' : 'NO (default OFF)'}`
  );
  console.log(`[codelink-terminal] Socket path: ${socketPath}`);
  console.log(
    `[codelink-terminal] Safety notice: Shells run as ${os.userInfo().username} with full file access.`
  );

  await server.start();
  console.log(`[codelink-terminal] Companion daemon running and listening for local commands.`);

  const shutdown = async () => {
    console.log('\n[codelink-terminal] Shutting down companion service...');
    await sessionTable.closeAll();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main(): Promise<void> {
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

    case 'list': {
      try {
        const res = await sendIpcCommand(socketPath, { command: 'list-sessions' });
        if (res.ok) {
          console.log('Active sessions:', JSON.stringify(res.data, null, 2));
        } else {
          console.error('Failed to list sessions:', res.error);
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
  kill-all       Emergency kill-switch: terminate all active terminal sessions
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
