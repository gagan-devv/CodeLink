import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CompanionConfigOptions {
  enabled: boolean;
  maxSessions: number;
  idleTimeoutMs: number;
  recordingEnabled: boolean;
  ringBufferSizeBytes: number;
  auditLogPath: string;
}

const DEFAULT_CONFIG: CompanionConfigOptions = {
  enabled: false, // Explicit opt-in required (default OFF)
  maxSessions: 8,
  idleTimeoutMs: 6 * 60 * 60 * 1000, // 6 hours
  recordingEnabled: false, // OFF by default
  ringBufferSizeBytes: 1024 * 1024, // 1 MB ring buffer per session
  auditLogPath: path.join(os.homedir(), '.codelink', 'terminal-audit.log'),
};

export class CompanionConfig {
  private config: CompanionConfigOptions;
  private filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath || path.join(os.homedir(), '.codelink', 'companion-config.json');
    this.config = { ...DEFAULT_CONFIG };
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
    } catch (err) {
      console.error('[CompanionConfig] Failed to save configuration:', err);
    }
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.save();
  }

  public get(): CompanionConfigOptions {
    return { ...this.config };
  }

  public update(patch: Partial<CompanionConfigOptions>): void {
    this.config = { ...this.config, ...patch };
    this.save();
  }
}
