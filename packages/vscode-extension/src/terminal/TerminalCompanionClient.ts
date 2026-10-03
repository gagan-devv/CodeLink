import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TerminalSessionInfo } from '@codelink/protocol';

export interface CompanionStatus {
  enabled: boolean;
  recordingEnabled: boolean;
  maxSessions: number;
  activeSessions: number;
  uptimeSeconds: number;
}

export interface IpcCommand {
  command:
    | 'status'
    | 'enable'
    | 'disable'
    | 'list-sessions'
    | 'kill-all'
    | 'kill-session'
    | 'revoke'
    | 'takeover'
    | 'pair'
    | 'approve-pairing'
    | 'list-devices'
    | 'audit';
  args?: Record<string, unknown>;
}

export interface IpcResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export class TerminalCompanionClient {
  private socketPath: string;

  constructor(customSocketPath?: string) {
    if (customSocketPath) {
      this.socketPath = customSocketPath;
    } else if (process.env.XDG_RUNTIME_DIR) {
      this.socketPath = path.join(process.env.XDG_RUNTIME_DIR, 'codelink-terminal.sock');
    } else {
      this.socketPath = path.join(os.homedir(), '.codelink', 'terminal.sock');
    }
  }

  public get path(): string {
    return this.socketPath;
  }

  public async isDaemonAvailable(): Promise<boolean> {
    if (!fs.existsSync(this.socketPath)) {
      return false;
    }
    return new Promise((resolve) => {
      const socket = net.createConnection(this.socketPath);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        resolve(false);
      });
      socket.setTimeout(500, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  public async sendCommand(cmd: IpcCommand): Promise<IpcResponse> {
    if (!fs.existsSync(this.socketPath)) {
      throw new Error('CodeLink terminal companion daemon is not running (socket file not found).');
    }

    return new Promise((resolve, reject) => {
      const client = net.createConnection(this.socketPath);
      let buffer = '';

      client.on('connect', () => {
        client.write(JSON.stringify(cmd) + '\n');
      });

      client.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
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
        reject(new Error('Companion daemon IPC command timed out.'));
      });
    });
  }

  public async getStatus(): Promise<CompanionStatus> {
    const res = await this.sendCommand({ command: 'status' });
    if (!res.ok) {
      throw new Error(res.error || 'Failed to query companion status');
    }
    return res.data as CompanionStatus;
  }

  public async listSessions(): Promise<TerminalSessionInfo[]> {
    const res = await this.sendCommand({ command: 'list-sessions' });
    if (!res.ok) {
      throw new Error(res.error || 'Failed to list terminal sessions');
    }
    return ((res.data as { sessions: TerminalSessionInfo[] })?.sessions ||
      []) as TerminalSessionInfo[];
  }

  public async takeoverSession(sessionId: string): Promise<IpcResponse> {
    return this.sendCommand({ command: 'takeover', args: { sessionId } });
  }

  public async killSession(sessionId: string): Promise<IpcResponse> {
    return this.sendCommand({ command: 'kill-session', args: { sessionId } });
  }

  public async killAllSessions(): Promise<IpcResponse> {
    return this.sendCommand({ command: 'kill-all' });
  }

  public async enableService(): Promise<IpcResponse> {
    return this.sendCommand({ command: 'enable' });
  }

  public async disableService(): Promise<IpcResponse> {
    return this.sendCommand({ command: 'disable' });
  }

  public async queryAudit(limit: number = 50): Promise<unknown[]> {
    const res = await this.sendCommand({ command: 'audit', args: { limit } });
    if (!res.ok) {
      throw new Error(res.error || 'Failed to query audit log');
    }
    return ((res.data as { events: unknown[] })?.events || []) as unknown[];
  }
}
