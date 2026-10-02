import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionTable } from './SessionTable';
import { PtyManager } from '../pty/PtyManager';

describe('SessionTable', () => {
  let pty: PtyManager;
  let table: SessionTable;

  beforeEach(() => {
    pty = new PtyManager();
    table = new SessionTable(pty, 8);
  });

  afterEach(async () => {
    await table.closeAll();
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

  it('closes a session and cleans up resources', async () => {
    table.createSession('sess-close', { title: 'To Close' });
    expect(table.has('sess-close')).toBe(true);

    await table.closeSession('sess-close');
    expect(table.has('sess-close')).toBe(false);
    expect(table.activeCount).toBe(0);
  });
});
