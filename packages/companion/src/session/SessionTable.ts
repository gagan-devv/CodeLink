import { PtyManager, PtySession } from '../pty/PtyManager';
import { RingBuffer } from './RingBuffer';
import { TerminalSessionInfo } from '@codelink/protocol';
import { AuditLogger } from '../audit/AuditLogger';
import { SessionRecorder } from '../recording/SessionRecorder';

export interface CreateSessionOptions {
  title?: string;
  cols?: number;
  rows?: number;
  ringCapacityBytes?: number;
}

export interface AttachResult {
  mode: 'observe' | 'control';
}

export interface SessionTableOptions {
  maxSessions?: number;
  controlIdleTimeoutMs?: number;
  auditLogger?: AuditLogger;
  sessionRecorder?: SessionRecorder;
}

export class TerminalSession {
  public title: string;
  public pty: PtySession;
  public ringBuffer: RingBuffer;
  public controllerDeviceId: string | null = null;
  public observerDeviceIds: Set<string> = new Set();
  public lastActivityTs: number = Date.now();
  public lastControllerActivityTs: number = Date.now();
  public active = true;

  constructor(
    public readonly id: string,
    ptySession: PtySession,
    title?: string,
    ringCapacityBytes?: number,
    private sessionRecorder?: SessionRecorder
  ) {
    this.title = title || `Terminal ${id.slice(-4)}`;
    this.pty = ptySession;
    this.ringBuffer = new RingBuffer(ringCapacityBytes || 1024 * 1024);

    // Stream PTY output into the ring buffer and recorder
    this.pty.onData((data) => {
      this.ringBuffer.write(data);
      this.touch();
      if (this.sessionRecorder?.isRecording(this.id)) {
        this.sessionRecorder.recordOutput(this.id, data);
      }
    });

    this.pty.onExit(() => {
      this.active = false;
    });
  }

  public touch(): void {
    this.lastActivityTs = Date.now();
  }

  public touchController(): void {
    const now = Date.now();
    this.lastActivityTs = now;
    this.lastControllerActivityTs = now;
  }

  public toInfo(): TerminalSessionInfo {
    return {
      id: this.id,
      title: this.title,
      controllerDeviceId: this.controllerDeviceId,
      observerCount: this.observerDeviceIds.size,
      active: this.active,
    };
  }
}

export class SessionTable {
  private sessions = new Map<string, TerminalSession>();
  private maxSessions: number = 8;
  private controlIdleTimeoutMs: number = 6 * 60 * 60 * 1000; // 6 hours default
  private auditLogger?: AuditLogger;
  private sessionRecorder?: SessionRecorder;
  private idleCheckTimer: NodeJS.Timeout | null = null;

  constructor(
    private ptyManager: PtyManager,
    optionsOrMaxSessions: number | SessionTableOptions = 8
  ) {
    if (typeof optionsOrMaxSessions === 'number') {
      this.maxSessions = optionsOrMaxSessions;
    } else {
      if (optionsOrMaxSessions.maxSessions !== undefined) {
        this.maxSessions = optionsOrMaxSessions.maxSessions;
      }
      if (optionsOrMaxSessions.controlIdleTimeoutMs !== undefined) {
        this.controlIdleTimeoutMs = optionsOrMaxSessions.controlIdleTimeoutMs;
      }
      this.auditLogger = optionsOrMaxSessions.auditLogger;
      this.sessionRecorder = optionsOrMaxSessions.sessionRecorder;
    }
  }

  public get activeCount(): number {
    return this.sessions.size;
  }

  public has(id: string): boolean {
    return this.sessions.has(id);
  }

  public get(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  public createSession(id: string, options: CreateSessionOptions = {}): TerminalSession {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum session limit reached (max ${this.maxSessions})`);
    }
    if (this.sessions.has(id)) {
      throw new Error(`Session ${id} already exists`);
    }

    const cols = options.cols || 80;
    const rows = options.rows || 24;

    const ptySession = this.ptyManager.spawnSession(id, {
      cols,
      rows,
    });

    if (this.sessionRecorder?.isEnabled()) {
      this.sessionRecorder.startRecording(id, options.title, cols, rows);
    }

    const session = new TerminalSession(
      id,
      ptySession,
      options.title,
      options.ringCapacityBytes,
      this.sessionRecorder
    );

    this.sessions.set(id, session);

    this.auditLogger?.log({
      type: 'session_created',
      sessionId: id,
      title: session.title,
      timestamp: Date.now(),
    });

    return session;
  }

  public attachDevice(
    sessionId: string,
    deviceId: string,
    requestedMode: 'observe' | 'control'
  ): AttachResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.touch();

    if (requestedMode === 'control') {
      if (session.controllerDeviceId === null || session.controllerDeviceId === deviceId) {
        session.controllerDeviceId = deviceId;
        session.touchController();
        session.observerDeviceIds.delete(deviceId);
        this.auditLogger?.log({
          type: 'device_attached',
          sessionId,
          deviceId,
          mode: 'control',
          timestamp: Date.now(),
        });
        return { mode: 'control' };
      } else {
        // Another device already has control -> demote to observer
        session.observerDeviceIds.add(deviceId);
        this.auditLogger?.log({
          type: 'device_attached',
          sessionId,
          deviceId,
          mode: 'observe',
          timestamp: Date.now(),
        });
        return { mode: 'observe' };
      }
    } else {
      // Requested observe
      if (session.controllerDeviceId === deviceId) {
        session.controllerDeviceId = null;
        this.auditLogger?.log({
          type: 'mode_transition',
          sessionId,
          deviceId,
          fromMode: 'control',
          toMode: 'observe',
          reason: 'client_requested_observe',
          timestamp: Date.now(),
        });
      }
      session.observerDeviceIds.add(deviceId);
      this.auditLogger?.log({
        type: 'device_attached',
        sessionId,
        deviceId,
        mode: 'observe',
        timestamp: Date.now(),
      });
      return { mode: 'observe' };
    }
  }

  public detachDevice(sessionId: string, deviceId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.controllerDeviceId === deviceId) {
      session.controllerDeviceId = null;
    }
    session.observerDeviceIds.delete(deviceId);
    this.auditLogger?.log({
      type: 'device_detached',
      sessionId,
      deviceId,
      timestamp: Date.now(),
    });
  }

  public canDeviceWrite(sessionId: string, deviceId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    return session.controllerDeviceId === deviceId;
  }

  public verifyDeviceCanWrite(
    sessionId: string,
    deviceId: string,
    action: 'input' | 'resize' | 'control' = 'input'
  ): void {
    if (!this.canDeviceWrite(sessionId, deviceId)) {
      this.auditLogger?.log({
        type: 'unauthorized_write_attempt',
        sessionId,
        deviceId,
        action,
        timestamp: Date.now(),
      });
      throw new Error(
        `Device ${deviceId} is not authorized to write to session ${sessionId} (mode is observe or not controller)`
      );
    }
  }

  public writeInput(sessionId: string, deviceId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    this.verifyDeviceCanWrite(sessionId, deviceId, 'input');
    session.touchController();
    session.pty.write(data);
  }

  public resizeSession(sessionId: string, deviceId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    this.verifyDeviceCanWrite(sessionId, deviceId, 'resize');
    session.touchController();
    session.pty.resize(cols, rows);
  }

  public checkIdleTimeouts(
    now: number = Date.now()
  ): Array<{ sessionId: string; demotedDeviceId: string }> {
    const demotions: Array<{ sessionId: string; demotedDeviceId: string }> = [];

    for (const session of this.sessions.values()) {
      if (
        session.controllerDeviceId &&
        now - session.lastControllerActivityTs >= this.controlIdleTimeoutMs
      ) {
        const demotedDeviceId = session.controllerDeviceId;
        session.observerDeviceIds.add(demotedDeviceId);
        session.controllerDeviceId = null;
        demotions.push({ sessionId: session.id, demotedDeviceId });

        this.auditLogger?.log({
          type: 'idle_timeout',
          sessionId: session.id,
          demotedDeviceId,
          idleDurationMs: now - session.lastControllerActivityTs,
          timestamp: now,
        });

        this.auditLogger?.log({
          type: 'mode_transition',
          sessionId: session.id,
          deviceId: demotedDeviceId,
          fromMode: 'control',
          toMode: 'observe',
          reason: 'idle_timeout_6h',
          timestamp: now,
        });
      }
    }

    return demotions;
  }

  public startIdleTimer(intervalMs: number = 60000): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
    }
    this.idleCheckTimer = setInterval(() => {
      this.checkIdleTimeouts();
    }, intervalMs);
  }

  public stopIdleTimer(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
  }

  public hostTakeover(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    const previousController = session.controllerDeviceId;
    if (previousController && previousController !== 'local-host') {
      session.observerDeviceIds.add(previousController);
      this.auditLogger?.log({
        type: 'mode_transition',
        sessionId,
        deviceId: previousController,
        fromMode: 'control',
        toMode: 'observe',
        reason: 'host_takeover',
        timestamp: Date.now(),
      });
    }
    session.controllerDeviceId = 'local-host';
    session.touchController();

    this.auditLogger?.log({
      type: 'host_takeover',
      sessionId,
      previousControllerDeviceId: previousController,
      timestamp: Date.now(),
    });
  }

  public async closeSession(sessionId: string, reason: string = 'closed'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (this.sessionRecorder?.isRecording(sessionId)) {
        this.sessionRecorder.stopRecording(sessionId);
      }
      await session.pty.kill();
      this.sessions.delete(sessionId);
      this.auditLogger?.log({
        type: 'session_terminated',
        sessionId,
        reason,
        timestamp: Date.now(),
      });
    }
  }

  public async emergencyKill(sessionId?: string, initiator: string = 'host'): Promise<void> {
    this.auditLogger?.log({
      type: 'emergency_kill',
      sessionId,
      initiator,
      timestamp: Date.now(),
    });

    if (sessionId) {
      await this.closeSession(sessionId, `emergency_kill_${initiator}`);
    } else {
      await this.closeAll(`emergency_kill_${initiator}`);
    }
  }

  public async closeAll(reason: string = 'closed_all'): Promise<void> {
    this.stopIdleTimer();
    const ids = Array.from(this.sessions.keys());
    for (const id of ids) {
      await this.closeSession(id, reason);
    }
  }

  public list(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.toInfo());
  }
}
