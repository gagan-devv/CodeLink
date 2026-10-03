import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuditLogger, AuditEvent } from './AuditLogger';

describe('AuditLogger', () => {
  let tempDir: string;
  let logFile: string;
  let logger: AuditLogger;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codelink-audit-test-'));
    logFile = path.join(tempDir, 'terminal-audit.log');
    logger = new AuditLogger(logFile);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('creates log file with 0600 permissions', () => {
    logger.log({
      type: 'session_created',
      sessionId: 'sess-123',
      title: 'Test Session',
      timestamp: Date.now(),
    });

    expect(fs.existsSync(logFile)).toBe(true);
    const stat = fs.statSync(logFile);
    // On POSIX, file mode mask 0o777 should be 0o600
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('appends structured audit events as JSON lines', () => {
    const event1: AuditEvent = {
      type: 'device_paired',
      deviceId: 'dev-phone-1',
      deviceName: 'Pixel 9',
      timestamp: 1000,
    };
    const event2: AuditEvent = {
      type: 'mode_transition',
      sessionId: 'sess-1',
      deviceId: 'dev-phone-1',
      fromMode: 'observe',
      toMode: 'control',
      reason: 'requested',
      timestamp: 2000,
    };

    logger.log(event1);
    logger.log(event2);

    const events = logger.getRecentEvents();
    expect(events.length).toBe(2);
    expect(events[0]).toEqual(event1);
    expect(events[1]).toEqual(event2);
  });

  it('never logs terminal input or output payloads', () => {
    // AuditLogger type should not have content / payload fields
    logger.log({
      type: 'unauthorized_write_attempt',
      sessionId: 'sess-1',
      deviceId: 'dev-observer',
      action: 'input',
      timestamp: Date.now(),
    });

    const content = fs.readFileSync(logFile, 'utf8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.action).toBe('input');
    expect(parsed.payload).toBeUndefined();
    expect(parsed.data).toBeUndefined();
    expect(parsed.content).toBeUndefined();
  });

  it('retrieves recent events with limit', () => {
    for (let i = 1; i <= 10; i++) {
      logger.log({
        type: 'session_created',
        sessionId: `sess-${i}`,
        title: `Tab ${i}`,
        timestamp: i * 100,
      });
    }

    const recent = logger.getRecentEvents(5);
    expect(recent.length).toBe(5);
    expect(recent[recent.length - 1].sessionId).toBe('sess-10');
  });
});
