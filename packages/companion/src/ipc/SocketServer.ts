import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';

export interface IpcCommand {
  command: 'status' | 'enable' | 'disable' | 'list-sessions' | 'kill-all' | 'revoke' | 'takeover';
  args?: Record<string, unknown>;
}

export interface IpcResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export class SocketServer {
  private server: net.Server | null = null;
  private startTime = Date.now();

  constructor(
    public readonly socketPath: string,
    private config: CompanionConfig,
    private sessionTable?: SessionTable
  ) {}

  public async start(): Promise<void> {
    const dir = path.dirname(this.socketPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(dir, 0o700);
      } catch {
        // ignore if not owner
      }
    }

    if (fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // ignore
      }
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        let buffer = '';

        socket.on('data', async (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const cmd: IpcCommand = JSON.parse(line);
              const res = await this.handleCommand(cmd);
              socket.write(JSON.stringify(res) + '\n');
            } catch (err) {
              const res: IpcResponse = {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              };
              socket.write(JSON.stringify(res) + '\n');
            }
          }
        });

        socket.on('error', () => {
          // ignore client socket errors
        });
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        try {
          fs.chmodSync(this.socketPath, 0o600);
        } catch (err) {
          console.warn('[SocketServer] Warning: failed to chmod socket to 0600:', err);
        }
        resolve();
      });
    });
  }

  private async handleCommand(cmd: IpcCommand): Promise<IpcResponse> {
    switch (cmd.command) {
      case 'status': {
        const conf = this.config.get();
        return {
          ok: true,
          data: {
            enabled: conf.enabled,
            recordingEnabled: conf.recordingEnabled,
            maxSessions: conf.maxSessions,
            activeSessions: this.sessionTable ? this.sessionTable.activeCount : 0,
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
          },
        };
      }

      case 'enable': {
        this.config.setEnabled(true);
        return {
          ok: true,
          data: { enabled: true, message: 'Terminal service enabled' },
        };
      }

      case 'disable': {
        this.config.setEnabled(false);
        if (this.sessionTable) {
          await this.sessionTable.closeAll();
        }
        return {
          ok: true,
          data: { enabled: false, message: 'Terminal service disabled and sessions closed' },
        };
      }

      case 'list-sessions': {
        const sessions = this.sessionTable ? this.sessionTable.list() : [];
        return {
          ok: true,
          data: { sessions },
        };
      }

      case 'kill-all': {
        if (this.sessionTable) {
          await this.sessionTable.closeAll();
        }
        return {
          ok: true,
          data: { message: 'All terminal sessions killed' },
        };
      }

      case 'takeover': {
        const sessionId = cmd.args?.sessionId as string;
        if (!sessionId || !this.sessionTable) {
          return { ok: false, error: 'sessionId required for takeover' };
        }
        this.sessionTable.hostTakeover(sessionId);
        return { ok: true, data: { message: `Reclaimed control of session ${sessionId}` } };
      }

      default:
        return { ok: false, error: `Unknown command: ${cmd.command}` };
    }
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (fs.existsSync(this.socketPath)) {
            try {
              fs.unlinkSync(this.socketPath);
            } catch {
              // ignore
            }
          }
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
