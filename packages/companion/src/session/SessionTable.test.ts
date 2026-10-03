import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionTable } from './SessionTable';
import { PtyManager } from '../pty/PtyManager';
import { AuditLogger } from '../audit/AuditLogger';
import { SessionRecorder } from '../recording/SessionRecorder';

describe('SessionTable', () => {
  let pty: PtyManager;
  let table: SessionTable;
  let tempDir: string;
  let auditLogger: AuditLogger;
  let sessionRecorder: SessionRecorder;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codelink-session-test-'));
    pty = new PtyManager();
    auditLogger = new AuditLogger(path.join(tempDir, 'audit.log'));
    sessionRecorder = new SessionRecorder({ recordDir: tempDir, enabled: true });
    table = new SessionTable(pty, {
      maxSessions: 8,
      controlIdleTimeoutMs: 1000, // 1s for testing idle timeout
      auditLogger,
      sessionRecorder,
    });
  });

  afterEach(async () => {
    await table.closeAll();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('creates sessions and caps at maxSessions (default 8)', () => {
    for (let i = 1; i <= 8; i++) {
      const sess = table.createSession(`sess-${i}`, { title: `Tab ${i}` });
      expect(sess.id).toBe(`sess-${i}`);
    }

    expect(table.activeCount).toBe(8);

    // 9th session should throw
    expect(() => {
      table.createSession('sess-9', { title: 'Tab 9' });
    }).toThrow(/maximum session limit reached/i);
  });

  it('enforces single controller per session (others observe)', () => {
    const sess = table.createSession('sess-roles', { title: 'Roles test' });

    // First device requests control
    const grant1 = table.attachDevice('sess-roles', 'device-phone', 'control');
    expect(grant1.mode).toBe('control');
    expect(sess.controllerDeviceId).toBe('device-phone');

    // Second device requests control -> relegated to observe
    const grant2 = table.attachDevice('sess-roles', 'device-tablet', 'control');
    expect(grant2.mode).toBe('observe');
    expect(sess.observerDeviceIds.has('device-tablet')).toBe(true);

    // Local host takeover reclaims control
    table.hostTakeover('sess-roles');
    expect(sess.controllerDeviceId).toBe('local-host');
    // device-phone is demoted to observer
    expect(sess.observerDeviceIds.has('device-phone')).toBe(true);
  });

  it('enforces mode permissions: observer cannot write input or resize', () => {
    table.createSession('sess-perms', { title: 'Permissions test' });
    table.attachDevice('sess-perms', 'dev-controller', 'control');
    table.attachDevice('sess-perms', 'dev-observer', 'observe');

    expect(table.canDeviceWrite('sess-perms', 'dev-controller')).toBe(true);
    expect(table.canDeviceWrite('sess-perms', 'dev-observer')).toBe(false);
    expect(table.canDeviceWrite('sess-perms', 'dev-unknown')).toBe(false);

    // Controller write succeeds
    expect(() => {
      table.writeInput('sess-perms', 'dev-controller', 'ls\n');
    }).not.toThrow();

    // Observer write is blocked and throws
    expect(() => {
      table.writeInput('sess-perms', 'dev-observer', 'rm -rf /\n');
    }).toThrow(/not authorized to write/i);

    // Observer resize is blocked and throws
    expect(() => {
      table.resizeSession('sess-perms', 'dev-observer', 120, 40);
    }).toThrow(/not authorized to write/i);

    // Check that unauthorized write attempt was audit-logged
    const events = auditLogger.getRecentEvents();
    const unauthorized = events.find((e) => e.type === 'unauthorized_write_attempt');
    expect(unauthorized).toBeDefined();
    expect(unauthorized?.deviceId).toBe('dev-observer');
  });

  it('drops control after idle timeout while shell continues running (Decision E)', async () => {
    const sess = table.createSession('sess-idle', { title: 'Idle test' });
    table.attachDevice('sess-idle', 'dev-idle-phone', 'control');
    expect(sess.controllerDeviceId).toBe('dev-idle-phone');

    // Fast-forward past idle timeout (1000ms configured in test)
    const futureTime = Date.now() + 2000;
    const demoted = table.checkIdleTimeouts(futureTime);

    expect(demoted.length).toBe(1);
    expect(demoted[0].sessionId).toBe('sess-idle');
    expect(demoted[0].demotedDeviceId).toBe('dev-idle-phone');

    // Controller was demoted to observer, controllerDeviceId is now null
    expect(sess.controllerDeviceId).toBeNull();
    expect(sess.observerDeviceIds.has('dev-idle-phone')).toBe(true);

    // PTY session remains alive and active!
    expect(sess.active).toBe(true);
    expect(table.has('sess-idle')).toBe(true);

    // Check audit log for idle timeout event
    const events = auditLogger.getRecentEvents();
    const idleEvent = events.find((e) => e.type === 'idle_timeout');
    expect(idleEvent).toBeDefined();
    expect(idleEvent?.sessionId).toBe('sess-idle');
  });

  it('persists detached sessions and allows re-attachment', () => {
    const sess = table.createSession('sess-persist', { title: 'Persist test' });
    table.attachDevice('sess-persist', 'dev-phone', 'control');

    // Device detaches (e.g. phone goes into background / disconnects)
    table.detachDevice('sess-persist', 'dev-phone');
    expect(sess.controllerDeviceId).toBeNull();
    expect(table.has('sess-persist')).toBe(true);
    expect(sess.active).toBe(true);

    // Device re-attaches and regains control
    const reattach = table.attachDevice('sess-persist', 'dev-phone', 'control');
    expect(reattach.mode).toBe('control');
    expect(sess.controllerDeviceId).toBe('dev-phone');
  });

  it('closes a session and cleans up resources', async () => {
    table.createSession('sess-close', { title: 'To Close' });
    expect(table.has('sess-close')).toBe(true);

    await table.closeSession('sess-close');
    expect(table.has('sess-close')).toBe(false);
    expect(table.activeCount).toBe(0);
  });
});
