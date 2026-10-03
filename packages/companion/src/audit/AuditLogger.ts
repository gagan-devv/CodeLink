import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type AuditEventType =
  | 'device_paired'
  | 'device_revoked'
  | 'session_created'
  | 'session_terminated'
  | 'device_attached'
  | 'device_detached'
  | 'mode_transition'
  | 'host_takeover'
  | 'emergency_kill'
  | 'idle_timeout'
  | 'unauthorized_write_attempt';

export interface BaseAuditEvent {
  type: AuditEventType;
  timestamp: number;
}

export interface DevicePairedAuditEvent extends BaseAuditEvent {
  type: 'device_paired';
  deviceId: string;
  deviceName?: string;
}

export interface DeviceRevokedAuditEvent extends BaseAuditEvent {
  type: 'device_revoked';
  deviceId: string;
}

export interface SessionCreatedAuditEvent extends BaseAuditEvent {
  type: 'session_created';
  sessionId: string;
  title?: string;
}

export interface SessionTerminatedAuditEvent extends BaseAuditEvent {
  type: 'session_terminated';
  sessionId: string;
  reason?: string;
}

export interface DeviceAttachedAuditEvent extends BaseAuditEvent {
  type: 'device_attached';
  sessionId: string;
  deviceId: string;
  mode: 'observe' | 'control';
}

export interface DeviceDetachedAuditEvent extends BaseAuditEvent {
  type: 'device_detached';
  sessionId: string;
  deviceId: string;
}

export interface ModeTransitionAuditEvent extends BaseAuditEvent {
  type: 'mode_transition';
  sessionId: string;
  deviceId: string;
  fromMode: 'observe' | 'control';
  toMode: 'observe' | 'control';
  reason?: string;
}

export interface HostTakeoverAuditEvent extends BaseAuditEvent {
  type: 'host_takeover';
  sessionId: string;
  previousControllerDeviceId?: string | null;
}

export interface EmergencyKillAuditEvent extends BaseAuditEvent {
  type: 'emergency_kill';
  sessionId?: string;
  initiator: string;
}

export interface IdleTimeoutAuditEvent extends BaseAuditEvent {
  type: 'idle_timeout';
  sessionId: string;
  demotedDeviceId: string;
  idleDurationMs?: number;
}

export interface UnauthorizedWriteAttemptAuditEvent extends BaseAuditEvent {
  type: 'unauthorized_write_attempt';
  sessionId: string;
  deviceId: string;
  action: 'input' | 'resize' | 'control';
}

export type AuditEvent =
  | DevicePairedAuditEvent
  | DeviceRevokedAuditEvent
  | SessionCreatedAuditEvent
  | SessionTerminatedAuditEvent
  | DeviceAttachedAuditEvent
  | DeviceDetachedAuditEvent
  | ModeTransitionAuditEvent
  | HostTakeoverAuditEvent
  | EmergencyKillAuditEvent
  | IdleTimeoutAuditEvent
  | UnauthorizedWriteAttemptAuditEvent;

export class AuditLogger {
  private logPath: string;

  constructor(customLogPath?: string) {
    if (customLogPath) {
      this.logPath = customLogPath;
    } else {
      const home = os.homedir();
      this.logPath = path.join(home, '.codelink', 'terminal-audit.log');
    }
  }

  public get path(): string {
    return this.logPath;
  }

  public log(event: AuditEvent): void {
    try {
      const dir = path.dirname(this.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      } else {
        try {
          fs.chmodSync(dir, 0o700);
        } catch {
          // ignore if already owned
        }
      }

      const fileExists = fs.existsSync(this.logPath);
      const line = JSON.stringify(event) + '\n';

      fs.appendFileSync(this.logPath, line, { encoding: 'utf8', mode: 0o600 });

      if (!fileExists) {
        try {
          fs.chmodSync(this.logPath, 0o600);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('[AuditLogger] Failed to write audit event:', err);
    }
  }

  public getRecentEvents(limit: number = 50): AuditEvent[] {
    try {
      if (!fs.existsSync(this.logPath)) {
        return [];
      }
      const raw = fs.readFileSync(this.logPath, 'utf8');
      const lines = raw
        .trim()
        .split('\n')
        .filter((l) => l.trim().length > 0);
      const events: AuditEvent[] = [];

      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // ignore corrupted line
        }
      }

      if (limit > 0 && events.length > limit) {
        return events.slice(events.length - limit);
      }
      return events;
    } catch {
      return [];
    }
  }
}
