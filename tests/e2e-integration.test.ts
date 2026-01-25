import { describe, it, expect, afterAll } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { startServer, mobileClients, extensionClients } from '../packages/relay-server/src/index';
import { FileContextPayload, SyncFullContextMessage, PingMessage } from '../packages/protocol/src/index';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { tmpdir } from 'os';

/**
 * End-to-End Integration Test for Git Integration & File Diffing
 * 
 * This test verifies the complete pipeline:
 * 1. Set up test Git repository with known files
 * 2. Start relay server in test mode
 * 3. Simulate VS Code extension behavior
 * 4. Simulate mobile client behavior
 * 5. Verify SYNC_FULL_CONTEXT message is sent
 * 6. Verify message is routed through relay
 * 7. Verify diff is received on mobile
 * 8. Verify timing is under 2000ms
 * 
 * Requirements: 7.5
 */

describe('End-to-End Integration Test', () => {
  let relayServer: SocketIOServer;
  let extensionClient: ClientSocket;
  let mobileClient: ClientSocket;
  let testRepoPath: string;
  let git: SimpleGit;
  const RELAY_PORT = 8081; // Use different port to avoid conflicts
  const RELAY_URL = `http://localhost:${RELAY_PORT}`;

  beforeAll(async () => {
    // Start relay server
    relayServer = startServer(RELAY_PORT);
    console.log('[E2E] Relay server started on port', RELAY_PORT);

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Clean up relay server
    if (relayServer) {
      await new Promise<void>((resolve) => {
        relayServer.close(() => {
          console.log('[E2E] Relay server closed');
          resolve();
        });
      });
    }
  });

  beforeEach(async () => {
    // Create temporary test Git repository
    testRepoPath = path.join(tmpdir(), `codelink-test-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });
    
    git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create initial file and commit
    const testFilePath = path.join(testRepoPath, 'test.ts');
    await fs.writeFile(testFilePath, 'const original = "content";\n');
    await git.add('test.ts');
    await git.commit('Initial commit');

    console.log('[E2E] Test Git repository created at', testRepoPath);

    // Clear client sets
    mobileClients.clear();
    extensionClients.clear();
  });

  afterEach(async () => {
    // Disconnect clients
    if (extensionClient?.connected) {
      extensionClient.disconnect();
    }
    if (mobileClient?.connected) {
      mobileClient.disconnect();
    }

    // Clean up test repository
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
      console.log('[E2E] Test repository cleaned up');
    } catch (error) {
      console.error('[E2E] Error cleaning up test repository:', error);
    }

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should complete end-to-end flow from file edit to mobile display within 2000ms', async () => {
    const startTime = Date.now();
    let _receivedPayload: FileContextPayload | null = null;

    // Step 1: Connect mobile client and register
    mobileClient = ioClient(RELAY_URL, {
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
    });

    await new Promise<void>((resolve) => {
      mobileClient.on('connect', () => {
        console.log('[E2E] Mobile client connected');
        
        // Send ping to register as mobile client
        const ping: PingMessage = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'ping',
          source: 'mobile',
        };
        mobileClient.emit('message', JSON.stringify(ping));
        
        // Wait for registration
        setTimeout(resolve, 100);
      });
    });

    // Step 2: Set up mobile client message listener
    const mobileMessagePromise = new Promise<FileContextPayload>((resolve) => {
      mobileClient.on('message', (data: string) => {
        console.log('[E2E] Mobile client received message');
        const message = JSON.parse(data);
        
        if (message.type === 'SYNC_FULL_CONTEXT') {
          console.log('[E2E] Mobile client received SYNC_FULL_CONTEXT');
          receivedPayload = message.payload;
          resolve(message.payload);
        }
      });
    });

    // Step 3: Connect extension client and register
    extensionClient = ioClient(RELAY_URL, {
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
    });

    await new Promise<void>((resolve) => {
      extensionClient.on('connect', () => {
        console.log('[E2E] Extension client connected');
        
        // Send ping to register as extension client
        const ping: PingMessage = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'ping',
          source: 'extension',
        };
        extensionClient.emit('message', JSON.stringify(ping));
        
        // Wait for registration
        setTimeout(resolve, 100);
      });
    });

    // Step 4: Simulate file edit in VS Code
    const testFilePath = path.join(testRepoPath, 'test.ts');
    const modifiedContent = 'const modified = "new content";\n';
    await fs.writeFile(testFilePath, modifiedContent);
    console.log('[E2E] File modified');

    // Step 5: Simulate VS Code extension pipeline
    // (Git Integration → Diff Generator → WebSocket)
    
    // Fetch HEAD version
    const headContent = await git.show(['HEAD:test.ts']);
    console.log('[E2E] Fetched HEAD version');

    // Read current file content
    const currentContent = await fs.readFile(testFilePath, 'utf-8');
    console.log('[E2E] Read current file content');

    // Create FileContextPayload
    const payload: FileContextPayload = {
      fileName: 'test.ts',
      originalFile: headContent,
      modifiedFile: currentContent,
      isDirty: true,
      timestamp: Date.now(),
    };

    // Create SYNC_FULL_CONTEXT message
    const message: SyncFullContextMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'SYNC_FULL_CONTEXT',
      payload,
    };

    // Step 6: Send message from extension to relay server
    extensionClient.emit('message', JSON.stringify(message));
    console.log('[E2E] Extension sent SYNC_FULL_CONTEXT message');

    // Step 7: Wait for mobile client to receive the message
    const receivedPayloadResult = await Promise.race([
      mobileMessagePromise,
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout waiting for message')), 3000)
      ),
    ]);

    // Step 8: Verify the message was received correctly
    expect(receivedPayloadResult).not.toBeNull();
    expect(receivedPayloadResult?.fileName).toBe('test.ts');
    expect(receivedPayloadResult?.originalFile).toBe(headContent);
    expect(receivedPayloadResult?.modifiedFile).toBe(modifiedContent);
    expect(receivedPayloadResult?.isDirty).toBe(true);
    expect(receivedPayloadResult?.timestamp).toBeGreaterThan(0);

    // Step 9: Verify timing is under 2000ms
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    console.log(`[E2E] Total time: ${totalTime}ms`);
    
    expect(totalTime).toBeLessThan(2000);
  });

  it('should handle untracked files correctly', async () => {
    // Connect clients
    mobileClient = ioClient(RELAY_URL);
    extensionClient = ioClient(RELAY_URL);

    await Promise.all([
      new Promise<void>((resolve) => {
        mobileClient.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'mobile',
          };
          mobileClient.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
      new Promise<void>((resolve) => {
        extensionClient.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'extension',
          };
          extensionClient.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
    ]);

    // Set up mobile client listener
    const mobileMessagePromise = new Promise<FileContextPayload>((resolve) => {
      mobileClient.on('message', (data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'SYNC_FULL_CONTEXT') {
          resolve(message.payload);
        }
      });
    });

    // Create new untracked file
    const newFilePath = path.join(testRepoPath, 'newfile.ts');
    const newFileContent = 'const newFile = "untracked";\n';
    await fs.writeFile(newFilePath, newFileContent);

    // Simulate extension behavior for untracked file
    // (getHeadVersion should return empty string for untracked files)
    const payload: FileContextPayload = {
      fileName: 'newfile.ts',
      originalFile: '', // Empty for untracked files
      modifiedFile: newFileContent,
      isDirty: false,
      timestamp: Date.now(),
    };

    const message: SyncFullContextMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'SYNC_FULL_CONTEXT',
      payload,
    };

    extensionClient.emit('message', JSON.stringify(message));

    // Verify mobile client receives the message
    const receivedPayload = await Promise.race([
      mobileMessagePromise,
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      ),
    ]);

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload?.fileName).toBe('newfile.ts');
    expect(receivedPayload?.originalFile).toBe(''); // Empty for untracked
    expect(receivedPayload?.modifiedFile).toBe(newFileContent);
  });

  it('should route messages to multiple mobile clients', async () => {
    // Connect extension client
    extensionClient = ioClient(RELAY_URL);
    await new Promise<void>((resolve) => {
      extensionClient.on('connect', () => {
        const ping: PingMessage = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'ping',
          source: 'extension',
        };
        extensionClient.emit('message', JSON.stringify(ping));
        setTimeout(resolve, 100);
      });
    });

    // Connect multiple mobile clients
    const mobileClient1 = ioClient(RELAY_URL);
    const mobileClient2 = ioClient(RELAY_URL);
    const mobileClient3 = ioClient(RELAY_URL);

    await Promise.all([
      new Promise<void>((resolve) => {
        mobileClient1.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'mobile',
          };
          mobileClient1.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
      new Promise<void>((resolve) => {
        mobileClient2.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'mobile',
          };
          mobileClient2.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
      new Promise<void>((resolve) => {
        mobileClient3.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'mobile',
          };
          mobileClient3.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
    ]);

    // Set up listeners for all mobile clients
    const receivedPayloads: FileContextPayload[] = [];
    const promises = [mobileClient1, mobileClient2, mobileClient3].map((client) => {
      return new Promise<FileContextPayload>((resolve) => {
        client.on('message', (data: string) => {
          const message = JSON.parse(data);
          if (message.type === 'SYNC_FULL_CONTEXT') {
            receivedPayloads.push(message.payload);
            resolve(message.payload);
          }
        });
      });
    });

    // Send message from extension
    const payload: FileContextPayload = {
      fileName: 'test.ts',
      originalFile: 'original',
      modifiedFile: 'modified',
      isDirty: true,
      timestamp: Date.now(),
    };

    const message: SyncFullContextMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'SYNC_FULL_CONTEXT',
      payload,
    };

    extensionClient.emit('message', JSON.stringify(message));

    // Wait for all mobile clients to receive the message
    await Promise.all(promises);

    // Verify all clients received the message
    expect(receivedPayloads).toHaveLength(3);
    receivedPayloads.forEach((received) => {
      expect(received.fileName).toBe('test.ts');
      expect(received.originalFile).toBe('original');
      expect(received.modifiedFile).toBe('modified');
      expect(received.isDirty).toBe(true);
    });

    // Clean up
    mobileClient1.disconnect();
    mobileClient2.disconnect();
    mobileClient3.disconnect();
  });

  it('should handle no-change scenario correctly', async () => {
    // Connect clients
    mobileClient = ioClient(RELAY_URL);
    extensionClient = ioClient(RELAY_URL);

    await Promise.all([
      new Promise<void>((resolve) => {
        mobileClient.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'mobile',
          };
          mobileClient.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
      new Promise<void>((resolve) => {
        extensionClient.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'extension',
          };
          extensionClient.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
    ]);

    // Set up mobile client listener
    const mobileMessagePromise = new Promise<FileContextPayload>((resolve) => {
      mobileClient.on('message', (data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'SYNC_FULL_CONTEXT') {
          resolve(message.payload);
        }
      });
    });

    // Fetch HEAD version (no changes)
    const testFilePath = path.join(testRepoPath, 'test.ts');
    const headContent = await git.show(['HEAD:test.ts']);
    const currentContent = await fs.readFile(testFilePath, 'utf-8');

    // Both should be the same (no changes)
    expect(currentContent).toBe(headContent);

    // Send message with no changes
    const payload: FileContextPayload = {
      fileName: 'test.ts',
      originalFile: headContent,
      modifiedFile: currentContent,
      isDirty: false,
      timestamp: Date.now(),
    };

    const message: SyncFullContextMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'SYNC_FULL_CONTEXT',
      payload,
    };

    extensionClient.emit('message', JSON.stringify(message));

    // Verify mobile client receives the message
    const receivedPayload = await Promise.race([
      mobileMessagePromise,
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      ),
    ]);

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload?.originalFile).toBe(receivedPayload?.modifiedFile);
    expect(receivedPayload?.isDirty).toBe(false);
  });

  it('should verify message structure completeness', async () => {
    // Connect clients
    mobileClient = ioClient(RELAY_URL);
    extensionClient = ioClient(RELAY_URL);

    await Promise.all([
      new Promise<void>((resolve) => {
        mobileClient.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'mobile',
          };
          mobileClient.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
      new Promise<void>((resolve) => {
        extensionClient.on('connect', () => {
          const ping: PingMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'ping',
            source: 'extension',
          };
          extensionClient.emit('message', JSON.stringify(ping));
          setTimeout(resolve, 100);
        });
      }),
    ]);

    // Set up mobile client listener
    const mobileMessagePromise = new Promise<SyncFullContextMessage>((resolve) => {
      mobileClient.on('message', (data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'SYNC_FULL_CONTEXT') {
          resolve(message);
        }
      });
    });

    // Send complete message
    const payload: FileContextPayload = {
      fileName: 'test.ts',
      originalFile: 'original content',
      modifiedFile: 'modified content',
      isDirty: true,
      timestamp: Date.now(),
    };

    const message: SyncFullContextMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'SYNC_FULL_CONTEXT',
      payload,
    };

    extensionClient.emit('message', JSON.stringify(message));

    // Verify message structure
    const receivedMessage = await Promise.race([
      mobileMessagePromise,
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      ),
    ]);

    // Verify all required fields are present
    expect(receivedMessage).not.toBeNull();
    expect(receivedMessage?.id).toBeDefined();
    expect(receivedMessage?.timestamp).toBeDefined();
    expect(receivedMessage?.type).toBe('SYNC_FULL_CONTEXT');
    expect(receivedMessage?.payload).toBeDefined();
    expect(receivedMessage?.payload.fileName).toBeDefined();
    expect(receivedMessage?.payload.originalFile).toBeDefined();
    expect(receivedMessage?.payload.modifiedFile).toBeDefined();
    expect(receivedMessage?.payload.isDirty).toBeDefined();
    expect(receivedMessage?.payload.timestamp).toBeDefined();
  });
});
