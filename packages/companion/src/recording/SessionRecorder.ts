import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionRecorderOptions {
  recordDir?: string;
  enabled?: boolean;
}

interface ActiveRecording {
  filePath: string;
  startTimestamp: number;
  fd: number;
}

export class SessionRecorder {
  private recordDir: string;
  private enabled: boolean;
  private activeRecordings = new Map<string, ActiveRecording>();

  constructor(options: SessionRecorderOptions = {}) {
    this.enabled = options.enabled ?? false;
    if (options.recordDir) {
      this.recordDir = options.recordDir;
    } else {
      this.recordDir = path.join(os.homedir(), '.codelink', 'recordings');
    }

    if (this.enabled) {
      console.warn(
        '[SessionRecorder] WARNING: Local session recording is enabled. Recordings may capture passwords, API keys, and sensitive data printed in the terminal.'
      );
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.enabled) {
      console.warn(
        '[SessionRecorder] WARNING: Local session recording is enabled. Recordings may capture passwords, API keys, and sensitive data printed in the terminal.'
      );
    }
  }

  public isRecording(sessionId: string): boolean {
    return this.activeRecordings.has(sessionId);
  }

  public getRecordingPath(sessionId: string): string | undefined {
    return this.activeRecordings.get(sessionId)?.filePath;
  }

  public startRecording(
    sessionId: string,
    title?: string,
    cols: number = 80,
    rows: number = 24
  ): string {
    if (!this.enabled) {
      return '';
    }

    if (this.activeRecordings.has(sessionId)) {
      return this.activeRecordings.get(sessionId)!.filePath;
    }

    try {
      if (!fs.existsSync(this.recordDir)) {
        fs.mkdirSync(this.recordDir, { recursive: true, mode: 0o700 });
      } else {
        try {
          fs.chmodSync(this.recordDir, 0o700);
        } catch {
          // ignore
        }
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeId}_${timestamp}.cast`;
      const filePath = path.join(this.recordDir, filename);

      const header = JSON.stringify({
        version: 2,
        width: cols,
        height: rows,
        timestamp,
        title: title || `Session ${sessionId}`,
      });

      const fd = fs.openSync(filePath, 'w', 0o600);
      fs.writeSync(fd, header + '\n');

      this.activeRecordings.set(sessionId, {
        filePath,
        startTimestamp: Date.now(),
        fd,
      });

      return filePath;
    } catch (err) {
      console.warn(`[SessionRecorder] Failed to start recording session ${sessionId}:`, err);
      return '';
    }
  }

  public recordOutput(sessionId: string, data: string): void {
    if (!this.enabled) {
      return;
    }

    const rec = this.activeRecordings.get(sessionId);
    if (!rec) {
      return;
    }

    try {
      const elapsedSeconds = (Date.now() - rec.startTimestamp) / 1000;
      const eventRecord = JSON.stringify([elapsedSeconds, 'o', data]) + '\n';
      fs.writeSync(rec.fd, eventRecord);
    } catch (err) {
      console.warn(`[SessionRecorder] Failed to record output for session ${sessionId}:`, err);
    }
  }

  public stopRecording(sessionId: string): void {
    const rec = this.activeRecordings.get(sessionId);
    if (!rec) {
      return;
    }

    try {
      fs.closeSync(rec.fd);
    } catch {
      // ignore
    }

    this.activeRecordings.delete(sessionId);
  }
}
