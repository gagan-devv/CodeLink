import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const { mockLogLine, MockWebSocket } = vi.hoisted(() => {
  const { EventEmitter } = require('events');
  const mockLogLine = vi.fn();
  class MockWebSocket extends EventEmitter {
    readyState = 1;
    send = vi.fn();
    terminate = vi.fn();
    close = vi.fn((code?: number, reason?: string) => {
      this.emit('close', code || 1000, Buffer.from(reason || ''));
    });
    constructor(public url: string, public options?: any) {
      super();
    }
  }
  return { mockLogLine, MockWebSocket };
});

vi.mock('../logger', () => ({
  logLine: (line: string) => mockLogLine(line),
}));

vi.mock('ws', () => {
  return {
    default: MockWebSocket,
  };
});

import { WsClient } from './WsClient';

describe('WsClient', () => {
  beforeEach(() => {
    mockLogLine.mockClear();
  });

  it('logs open, close, and error without tokens', () => {
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();
    const onMessage = vi.fn();

    const client = new WsClient({
      onConnected,
      onDisconnected,
      onMessage,
    });

    expect(client.isConnected()).toBe(false);

    client.connect('ws://localhost:8082', 'secret-token-xyz');

    const wsInstance = (client as any).ws as InstanceType<typeof MockWebSocket>;
    expect(wsInstance).toBeDefined();
    expect(wsInstance.url).toBe('ws://localhost:8082?token=secret-token-xyz');

    // Simulate open event
    wsInstance.emit('open');
    expect(client.isConnected()).toBe(true);
    expect(onConnected).toHaveBeenCalled();

    // Verify open log line does NOT contain the secret token
    expect(mockLogLine).toHaveBeenCalledWith('[WebSocket] Connection opened: ws://localhost:8082');
    expect(mockLogLine.mock.calls.some((c) => String(c[0]).includes('secret-token-xyz'))).toBe(
      false
    );

    // Simulate error event
    mockLogLine.mockClear();
    wsInstance.emit('error', new Error('Connection refused'));
    expect(mockLogLine).toHaveBeenCalledWith('[WebSocket] Connection error: Connection refused');
    expect(wsInstance.terminate).toHaveBeenCalled();

    // Simulate close event
    mockLogLine.mockClear();
    wsInstance.emit('close', 1006, Buffer.from('Abnormal Closure'));
    expect(client.isConnected()).toBe(false);
    expect(onDisconnected).toHaveBeenCalled();
    expect(mockLogLine).toHaveBeenCalledWith(
      '[WebSocket] Connection closed: code=1006 reason=Abnormal Closure'
    );

    // Simulate message event
    mockLogLine.mockClear();
    const msg = JSON.stringify({
      type: 'SNAPSHOT_REQUEST',
      payload: { fileName: '', reason: 'initial' },
      id: 'req-1',
    });
    wsInstance.emit('message', Buffer.from(msg));
    expect(onMessage).toHaveBeenCalledWith(
      'SNAPSHOT_REQUEST',
      { fileName: '', reason: 'initial' },
      'req-1'
    );
    expect(mockLogLine).toHaveBeenCalledWith('[WebSocket] Received message: type=SNAPSHOT_REQUEST');
  });
});
