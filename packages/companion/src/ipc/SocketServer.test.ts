import { describe, it, expect, afterEach } from 'vitest';
import { SocketServer } from './SocketServer';
import { CompanionConfig } from '../service/CompanionConfig';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

describe('SocketServer', () => {
  const testDir = path.join(process.cwd(), 'scratch-socket-test');
  const testSock = path.join(testDir, 'test.sock');
  let server: SocketServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    if (fs.existsSync(testSock)) {
      fs.unlinkSync(testSock);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  });

  it('creates Unix socket with strict 0600 permissions', async () => {
    const config = new CompanionConfig(path.join(testDir, 'config.json'));
    server = new SocketServer(testSock, config);
    await server.start();

    expect(fs.existsSync(testSock)).toBe(true);

    const stat = fs.statSync(testSock);
    // mode & 0777 should be 0600 (read/write for owner only)
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('handles status command over the Unix socket', async () => {
    const config = new CompanionConfig(path.join(testDir, 'config.json'));
    server = new SocketServer(testSock, config);
    await server.start();

    const client = net.createConnection(testSock);
    const responsePromise = new Promise<string>((resolve) => {
      client.on('data', (d) => resolve(d.toString('utf8')));
    });

    client.write(JSON.stringify({ command: 'status' }) + '\n');
    const respRaw = await responsePromise;
    const resp = JSON.parse(respRaw);

    expect(resp.ok).toBe(true);
    expect(resp.data.enabled).toBe(false); // default OFF
    client.end();
  });
});
