import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { useTerminalStore } from './useTerminalStore';
import { handleMessage } from '../ws/MessageDispatcher';
import { wsManager } from '../ws/WsManager';
import { MobileE2EESession } from '../crypto/MobileE2EESession';
import {
  generateKeyPair,
  nobleKxClient,
  nobleKxServer,
  toBase64,
  toHex,
} from '../crypto/nobleKx';
import { EncryptedPacket } from '@codelink/protocol';

describe('Terminal E2EE and Mobile MessageDispatcher', () => {
  let clientSession: MobileE2EESession;
  let serverSession: MobileE2EESession;

  beforeEach(() => {
    useTerminalStore.getState().reset();

    const clientKp = generateKeyPair();
    const serverKp = generateKeyPair();

    const clientKeys = nobleKxClient(clientKp.publicKey, clientKp.privateKey, serverKp.publicKey);
    const serverKeys = nobleKxServer(serverKp.publicKey, serverKp.privateKey, clientKp.publicKey);

    clientSession = new MobileE2EESession('client', clientKeys.sharedTx, clientKeys.sharedRx);
    serverSession = new MobileE2EESession('host', serverKeys.sharedTx, serverKeys.sharedRx);
  });

  it('refuses plaintext transmission when no E2EE session exists', () => {
    const store = useTerminalStore.getState();
    expect(store.e2eeSession).toBeNull();

    const result = store.sendEncryptedInput('sess-1', 'ls -la\n');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Plaintext transmission refused');

    // Error is set in store
    expect(useTerminalStore.getState().e2eeError).toContain('Plaintext transmission refused');
    expect(useTerminalStore.getState().e2eeState).toBe('error');
  });

  it('encrypts input and transmits via wsManager when E2EE session exists', () => {
    const sendSpy = vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    useTerminalStore.getState().setE2EESession(clientSession, 'dev-test-1');
    expect(useTerminalStore.getState().e2eeState).toBe('paired');

    const result = useTerminalStore.getState().sendEncryptedInput('sess-1', 'echo 42\n');
    expect(result.success).toBe(true);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const [msgType, rawPayload] = sendSpy.mock.calls[0];
    const payload = rawPayload as { sessionId: string; data: string; generation: number };
    expect(msgType).toBe('TERM_INPUT');
    expect(payload.sessionId).toBe('sess-1');
    expect(payload.generation).toBe(1);

    // Assert that payload.data is a valid EncryptedPacket and NOT plaintext
    expect(payload.data).not.toContain('echo 42');
    const packet: EncryptedPacket = JSON.parse(payload.data);
    expect(packet.seq).toBe(1);
    expect(packet.ciphertext).toBeDefined();
    expect(packet.nonce).toBeDefined();

    sendSpy.mockRestore();
  });

  it('decrypts encrypted TERM_OUTPUT via MessageDispatcher', () => {
    useTerminalStore.getState().setE2EESession(clientSession, 'dev-test-1');

    // Server encrypts output
    const outputPlaintext = 'output from pty shell\r\n';
    const serverPacket = serverSession.encrypt(outputPlaintext);

    // Incoming TERM_OUTPUT with encrypted payload
    handleMessage('TERM_OUTPUT', { sessionId: 'sess-1', data: JSON.stringify(serverPacket) }, 'msg-1');

    const output = useTerminalStore.getState().getOutput('sess-1');
    expect(output).toBe(outputPlaintext);
  });

  it('rejects plaintext TERM_OUTPUT when active E2EE session exists', () => {
    useTerminalStore.getState().setE2EESession(clientSession, 'dev-test-1');

    handleMessage('TERM_OUTPUT', { sessionId: 'sess-1', data: 'unencrypted plaintext output' }, 'msg-2');

    // Output is not appended
    expect(useTerminalStore.getState().getOutput('sess-1')).toBe('');
    // Error is flagged
    expect(useTerminalStore.getState().e2eeError).toContain('Plaintext terminal output rejected');
  });

  it('rejects corrupted encrypted TERM_OUTPUT', () => {
    useTerminalStore.getState().setE2EESession(clientSession, 'dev-test-1');

    const corruptedPacket: EncryptedPacket = {
      seq: 1,
      nonce: toBase64(new Uint8Array(24)),
      ciphertext: toBase64(new Uint8Array(32)),
    };

    handleMessage('TERM_OUTPUT', { sessionId: 'sess-1', data: JSON.stringify(corruptedPacket) }, 'msg-3');

    expect(useTerminalStore.getState().getOutput('sess-1')).toBe('');
    expect(useTerminalStore.getState().e2eeError).toContain('Failed to decrypt terminal output');
  });
});
