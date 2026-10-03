import * as pty from 'node-pty';
import { execSync } from 'child_process';

export interface PtySpawnOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export class PtySession {
  public cols: number;
  public rows: number;
  private ptyProcess: pty.IPty;
  private isAlive = true;

  constructor(
    public readonly id: string,
    options: PtySpawnOptions = {}
  ) {
    this.cols = options.cols || 80;
    this.rows = options.rows || 24;

    const shell = options.shell || process.env.SHELL || '/bin/bash';
    const cwd = options.cwd || process.env.HOME || process.cwd();
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      ...options.env,
    };

    this.ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd,
      env: env as { [key: string]: string },
    });
  }

  public get pid(): number {
    return this.ptyProcess.pid;
  }

  public write(data: string): void {
    if (this.isAlive) {
      this.ptyProcess.write(data);
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.isAlive && cols > 0 && rows > 0) {
      this.cols = cols;
      this.rows = rows;
      try {
        this.ptyProcess.resize(cols, rows);
      } catch (err) {
        console.warn(`[PtySession:${this.id}] Resize error:`, err);
      }
    }
  }

  public onData(listener: (data: string) => void): { dispose: () => void } {
    return this.ptyProcess.onData(listener);
  }

  public onExit(listener: (exitCode: number, signal?: number) => void): { dispose: () => void } {
    return this.ptyProcess.onExit((e) => {
      this.isAlive = false;
      listener(e.exitCode, e.signal);
    });
  }

  /**
   * Kills the PTY shell and its entire descendant process tree.
   * Uses process group signaling (-pid) and tree discovery to leave no orphan processes.
   */
  public async kill(): Promise<void> {
    if (!this.isAlive) {
      return;
    }
    this.isAlive = false;
    const pid = this.ptyProcess.pid;

    // Collect all child PIDs before killing
    const childPids = this.getDescendantPids(pid);

    // 1. Try SIGHUP / SIGTERM to process group
    try {
      process.kill(-pid, 'SIGHUP');
    } catch {
      try {
        process.kill(pid, 'SIGHUP');
      } catch {
        // already gone
      }
    }

    // Also send SIGHUP/SIGTERM to known child PIDs
    for (const cpid of childPids) {
      try {
        process.kill(cpid, 'SIGTERM');
      } catch {
        // ignore
      }
    }

    // Wait 100ms for graceful cleanup
    await new Promise((r) => setTimeout(r, 100));

    // 2. SIGKILL to process group and children
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }

    for (const cpid of childPids) {
      try {
        process.kill(cpid, 'SIGKILL');
      } catch {
        // ignore
      }
    }

    try {
      this.ptyProcess.kill();
    } catch {
      // ignore
    }
  }

  private getDescendantPids(rootPid: number): number[] {
    const pids: number[] = [];
    try {
      // Use pgrep -P to find direct children
      const output = execSync(`pgrep -P ${rootPid} || true`, { encoding: 'utf8' }).trim();
      if (output) {
        const lines = output
          .split(/\s+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        for (const childPid of lines) {
          pids.push(childPid);
          pids.push(...this.getDescendantPids(childPid));
        }
      }
    } catch {
      // ignore
    }
    return pids;
  }
}

export class PtyManager {
  private sessions = new Map<string, PtySession>();

  public spawnSession(id: string, options?: PtySpawnOptions): PtySession {
    if (this.sessions.has(id)) {
      throw new Error(`Session with id ${id} already exists`);
    }
    const session = new PtySession(id, options);
    this.sessions.set(id, session);

    session.onExit(() => {
      this.sessions.delete(id);
    });

    return session;
  }

  public getSession(id: string): PtySession | undefined {
    return this.sessions.get(id);
  }

  public async killSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      await session.kill();
      this.sessions.delete(id);
    }
  }

  public async killAll(): Promise<void> {
    const promises = Array.from(this.sessions.values()).map((s) => s.kill());
    await Promise.all(promises);
    this.sessions.clear();
  }
}
