import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable } from '../session/SessionTable';
import { PairingManager } from '../crypto/PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import { AuditLogger } from '../audit/AuditLogger';
import { SessionRecorder } from '../recording/SessionRecorder';

import { DaemonRelayManager } from '../transport/DaemonRelayManager';

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
    | 'audit'
    | 'attach-session'
    | 'detach-session';
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
    private sessionTable?: SessionTable,
    private pairingManager?: PairingManager,
    private deviceStore?: PairedDeviceStore,
    private auditLogger?: AuditLogger,
    private sessionRecorder?: SessionRecorder,
    private relayManager?: DaemonRelayManager
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
        if (this.relayManager) {
          this.relayManager.autoAttachIfAvailable().catch(() => {});
        }
        return {
          ok: true,
          data: { enabled: true, message: 'Terminal service enabled' },
        };
      }

      case 'disable': {
        this.config.setEnabled(false);
        if (this.relayManager) {
          await this.relayManager.detachSession();
        }
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
          await this.sessionTable.emergencyKill(undefined, 'socket_ipc');
        }
        return {
          ok: true,
          data: { message: 'All terminal sessions killed' },
        };
      }

      case 'kill-session': {
        const sessionId = cmd.args?.sessionId as string;
        if (!sessionId || !this.sessionTable) {
          return { ok: false, error: 'sessionId required for kill-session' };
        }
        await this.sessionTable.emergencyKill(sessionId, 'socket_ipc');
        return {
          ok: true,
          data: { message: `Terminated session ${sessionId}` },
        };
      }

      case 'audit': {
        if (!this.auditLogger) {
          return { ok: false, error: 'Audit logger not configured' };
        }
        const limit = typeof cmd.args?.limit === 'number' ? cmd.args.limit : 50;
        const events = this.auditLogger.getRecentEvents(limit);
        return {
          ok: true,
          data: { events },
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

      case 'pair': {
        if (!this.pairingManager) {
          return { ok: false, error: 'Pairing manager not initialized' };
        }
        const challenge = this.pairingManager.createPairingChallenge();
        return {
          ok: true,
          data: challenge,
        };
      }

      case 'approve-pairing': {
        const sessionToken = cmd.args?.sessionToken as string;
        if (!sessionToken || !this.pairingManager) {
          return { ok: false, error: 'sessionToken required' };
        }
        const ok = this.pairingManager.approve(sessionToken);
        return {
          ok,
          data: { approved: ok },
        };
      }

      case 'revoke': {
        const deviceId = cmd.args?.deviceId as string;
        if (!deviceId || !this.deviceStore) {
          return { ok: false, error: 'deviceId required' };
        }
        const ok = this.deviceStore.revokeDevice(deviceId);
        return {
          ok,
          data: { revoked: ok, deviceId },
        };
      }

      case 'list-devices': {
        const devices = this.deviceStore ? this.deviceStore.list() : [];
        return {
          ok: true,
          data: { devices },
        };
      }

      case 'attach-session': {
        if (!this.relayManager) {
          return { ok: false, error: 'Relay manager not configured on daemon' };
        }
        const sessionId = cmd.args?.sessionId as string;
        if (!sessionId) {
          return { ok: false, error: 'sessionId required for attach-session' };
        }
        try {
          await this.relayManager.attachSession({
            sessionId,
            relayWssUrl: cmd.args?.relayWssUrl as string | undefined,
            authUrl: cmd.args?.authUrl as string | undefined,
            laptopId: cmd.args?.laptopId as string | undefined,
            privateKeyPem: cmd.args?.privateKeyPem as string | undefined,
          });
          return { ok: true, data: { attached: true, sessionId } };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      case 'detach-session': {
        if (!this.relayManager) {
          return { ok: false, error: 'Relay manager not configured on daemon' };
        }
        await this.relayManager.detachSession();
        return { ok: true, data: { detached: true } };
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
