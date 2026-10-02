import { PtyManager, PtySession } from '../pty/PtyManager';
import { RingBuffer } from './RingBuffer';
import { TerminalSessionInfo } from '@codelink/protocol';

export interface CreateSessionOptions {
  title?: string;
  cols?: number;
  rows?: number;
  ringCapacityBytes?: number;
}

export interface AttachResult {
  mode: 'observe' | 'control';
}

export class TerminalSession {
  public title: string;
  public pty: PtySession;
  public ringBuffer: RingBuffer;
  public controllerDeviceId: string | null = null;
  public observerDeviceIds: Set<string> = new Set();
  public lastActivityTs: number = Date.now();
  public active = true;

  constructor(
    public readonly id: string,
    ptySession: PtySession,
    title?: string,
    ringCapacityBytes?: number
  ) {
    this.title = title || `Terminal ${id.slice(-4)}`;
    this.pty = ptySession;
    this.ringBuffer = new RingBuffer(ringCapacityBytes || 1024 * 1024);

    // Stream PTY output into the ring buffer
    this.pty.onData((data) => {
      this.ringBuffer.write(data);
      this.touch();
    });

    this.pty.onExit(() => {
      this.active = false;
    });
  }

  public touch(): void {
    this.lastActivityTs = Date.now();
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

  constructor(
    private ptyManager: PtyManager,
    private maxSessions: number = 8
  ) {}

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

    const ptySession = this.ptyManager.spawnSession(id, {
      cols: options.cols || 80,
      rows: options.rows || 24,
    });

    const session = new TerminalSession(id, ptySession, options.title, options.ringCapacityBytes);

    this.sessions.set(id, session);
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
        session.observerDeviceIds.delete(deviceId);
        return { mode: 'control' };
      } else {
        // Another device already has control -> demote to observer
        session.observerDeviceIds.add(deviceId);
        return { mode: 'observe' };
      }
    } else {
      // Requested observe
      if (session.controllerDeviceId === deviceId) {
        session.controllerDeviceId = null;
      }
      session.observerDeviceIds.add(deviceId);
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
  }

  public hostTakeover(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.controllerDeviceId && session.controllerDeviceId !== 'local-host') {
      session.observerDeviceIds.add(session.controllerDeviceId);
    }
    session.controllerDeviceId = 'local-host';
    session.touch();
  }

  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.pty.kill();
      this.sessions.delete(sessionId);
    }
  }

  public async closeAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    for (const id of ids) {
      await this.closeSession(id);
    }
  }

  public list(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.toInfo());
  }
}
