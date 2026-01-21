import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ProtocolMessage } from '@codelink/protocol';

// Mock socket.io-client - must be defined before vi.mock
const mockSocket = {
  connected: false,
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

import { WebSocketClient } from './WebSocketClient';

describe('WebSocketClient - Property-Based Tests', () => {
  let client: WebSocketClient;
  let connectHandler: () => void;

  beforeEach(async () => {
    const { io } = await import('socket.io-client');
    
    client = new WebSocketClient();
    mockSocket.connected = false;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    vi.mocked(io).mockClear();

    mockSocket.on.mockImplementation((event: string, handler: any) => {
      if (event === 'connect') connectHandler = handler;
    });
  });

  afterEach(() => {
    client.disconnect();
  });

  // Feature: git-integration-diffing, Property 13: Message transmission
  it('Property 13: should transmit any message when connected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 0 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.boolean(),
        (id, timestamp, fileName, originalFile, modifiedFile, isDirty) => {
          client.connect('http://localhost:3000');
          mockSocket.connected = true;
          mockSocket.emit.mockClear();

          const message: ProtocolMessage = {
            id,
            timestamp,
            type: 'SYNC_FULL_CONTEXT',
            payload: {
              fileName,
              originalFile,
              modifiedFile,
              isDirty,
              timestamp,
            },
          };

          client.send(message);

          expect(mockSocket.emit).toHaveBeenCalledWith('message', message);
          expect(mockSocket.emit).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: git-integration-diffing, Property 15: Message queueing on disconnect
  it('Property 15: should queue any message when disconnected', () => {
    vi.useFakeTimers();

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            timestamp: fc.integer({ min: 0 }),
            fileName: fc.string({ minLength: 1 }),
            originalFile: fc.string(),
            modifiedFile: fc.string(),
            isDirty: fc.boolean(),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (messageData) => {
          client.connect('http://localhost:3000');
          mockSocket.connected = false;
          mockSocket.emit.mockClear();

          const messages: ProtocolMessage[] = messageData.map(data => ({
            id: data.id,
            timestamp: data.timestamp,
            type: 'SYNC_FULL_CONTEXT',
            payload: {
              fileName: data.fileName,
              originalFile: data.originalFile,
              modifiedFile: data.modifiedFile,
              isDirty: data.isDirty,
              timestamp: data.timestamp,
            },
          }));

          messages.forEach(msg => client.send(msg));

          expect(client.getQueueSize()).toBe(messages.length);
          expect(mockSocket.emit).not.toHaveBeenCalled();

          mockSocket.connected = true;
          connectHandler();
          vi.runAllTimers();

          expect(client.getQueueSize()).toBe(0);
          expect(mockSocket.emit).toHaveBeenCalledTimes(messages.length);

          messages.forEach(msg => {
            expect(mockSocket.emit).toHaveBeenCalledWith('message', msg);
          });
        }
      ),
      { numRuns: 100 }
    );

    vi.useRealTimers();
  });

  // Additional property: Connection state consistency
  it('Property: isConnected should reflect actual socket state', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (connected) => {
          client.connect('http://localhost:3000');
          mockSocket.connected = connected;

          expect(client.isConnected()).toBe(connected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
