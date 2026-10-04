import { describe, it, expect } from 'vitest';
import { PtyManager } from './PtyManager';
import { execSync } from 'child_process';

describe('PtyManager', () => {
  it('spawns the user login shell and receives output', async () => {
    const pty = new PtyManager();
    const session = pty.spawnSession('test-sess-1', {
      cols: 80,
      rows: 24,
    });

    expect(session.id).toBe('test-sess-1');
    expect(session.pid).toBeGreaterThan(0);

    const outputPromise = new Promise<string>((resolve) => {
      let accumulated = '';
      session.onData((data) => {
        accumulated += data;
        if (accumulated.includes('PTY_ECHO_TEST')) {
          resolve(accumulated);
        }
      });
    });

    session.write('echo PTY_ECHO_TEST\n');
    const output = await outputPromise;
    expect(output).toContain('PTY_ECHO_TEST');

    await session.kill();
  });

  it('resizes the PTY terminal window without throwing', async () => {
    const pty = new PtyManager();
    const session = pty.spawnSession('test-sess-resize', {
      cols: 80,
      rows: 24,
    });

    expect(() => {
      session.resize(100, 30);
    }).not.toThrow();

    expect(session.cols).toBe(100);
    expect(session.rows).toBe(30);

    await session.kill();
  });

  it('cleans up process tree on session kill (no orphaned background processes)', async () => {
    const pty = new PtyManager();
    const session = pty.spawnSession('test-sess-orphan', {
      cols: 80,
      rows: 24,
    });

    // Launch a background sleep
    session.write('sleep 60 &\n');

    // Give the shell a moment to spawn the background child
    let childPidRaw = '';
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      childPidRaw = execSync(`pgrep -P ${session.pid} || true`, {
        encoding: 'utf8',
      }).trim();
      if (childPidRaw) break;
    }

    expect(childPidRaw).not.toBe('');
    const childPid = childPidRaw.split(/\s+/)[0];

    // Verify child is alive
    const isAliveBefore = execSync(`kill -0 ${childPid} 2>/dev/null && echo alive || true`, {
      encoding: 'utf8',
    }).trim();
    expect(isAliveBefore).toBe('alive');

    // Terminate session
    await session.kill();

    // Verify child process was terminated and is no longer running
    await new Promise((r) => setTimeout(r, 400));
    const isAliveAfter = execSync(`kill -0 ${childPid} 2>/dev/null && echo alive || true`, {
      encoding: 'utf8',
    }).trim();
    expect(isAliveAfter).toBe('');
  });
});
