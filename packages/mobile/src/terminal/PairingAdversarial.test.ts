import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: { create: (s: any) => s },
}));

const mockStorage = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => mockStorage.get(key) || null),
  setItemAsync: vi.fn(async (key: string, val: string) => {
    mockStorage.set(key, val);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
}));

import { useTerminalStore } from './useTerminalStore';
import { MobilePairingService } from '../crypto/MobilePairingService';
import { handleMessage } from '../ws/MessageDispatcher';
import { wsManager } from '../ws/WsManager';
import {
  generateKeyPair,
  toBase64,
  nobleKxServer,
  computeClientSas,
  computeApprovalProof,
} from '../crypto/nobleKx';
import { SecureDeviceStore } from '../crypto/SecureDeviceStore';
import { MobileE2EESession } from '../crypto/MobileE2EESession';

describe('Pairing Adversarial & Security Edge Cases', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    mockStorage.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    await SecureDeviceStore.clearPairedHost();
    useTerminalStore.getState().reset();
    MobilePairingService.cancelPairing();
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);
  });

  afterEach(() => {
    MobilePairingService.cancelPairing();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fails closed when host public key is missing in TERM_PAIR_RESP', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;
    expect(attempt).not.toBeNull();

    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-abc',
      // hostPublicKey omitted
    });

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('missing candidate host public key');
    expect(MobilePairingService.getActiveAttempt()).toBeNull();
  });

  it('fails closed when host public key has invalid length in TERM_PAIR_RESP', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;

    // 16-byte key instead of 32 bytes
    const shortKey = new Uint8Array(16);
    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-abc',
      hostPublicKey: toBase64(shortKey),
    });

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('expected 32 bytes');
    expect(MobilePairingService.getActiveAttempt()).toBeNull();
  });

  it('expires pairing attempt and refuses stale responses after 5-minute attempt lifetime limit', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;
    expect(attempt).not.toBeNull();

    // Host responds with valid pair response before initial response timeout
    const hostKp = generateKeyPair();
    const clientKp = (await SecureDeviceStore.getClientKeyPair())!;
    const computedSas = computeClientSas(
      hostKp.publicKey,
      clientKp.publicKey,
      '123456',
      attempt.attemptId,
      'token-123'
    );

    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      sas: computedSas,
    });

    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');

    // Fast-forward past 5 minutes (300,001 ms)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('expired after 5 minutes');
    expect(MobilePairingService.getActiveAttempt()).toBeNull();

    // A late approval response arriving for expired attempt must be rejected
    await MobilePairingService.handlePairStatus({
      approved: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'dev-001',
      approvalProof: 'fake-proof',
    });

    expect(useTerminalStore.getState().e2eeState).toBe('error');
    expect(MobilePairingService.getActiveAttempt()).toBeNull();
  });

  it('ignores unsolicited TERM_PAIR_STATUS_RESP when client is unpaired', async () => {
    const hostKp = generateKeyPair();
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');

    // Attacker sends approved status frame to an idle client
    await MobilePairingService.handlePairStatus({
      approved: true,
      attemptId: 'unsolicited-attempt',
      sessionToken: 'unsolicited-token',
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'dev-rogue-001',
      approvalProof: 'fake-proof',
    });

    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
    expect(await SecureDeviceStore.getPairedHost()).toBeNull();
  });

  it('ignores late approval response after user cancels pairing', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;
    const hostKp = generateKeyPair();
    const clientKp = (await SecureDeviceStore.getClientKeyPair())!;
    const computedSas = computeClientSas(
      hostKp.publicKey,
      clientKp.publicKey,
      '123456',
      attempt.attemptId,
      'token-123'
    );

    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      sas: computedSas,
    });

    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');

    // User cancels pairing
    MobilePairingService.cancelPairing();
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');

    // Late approval arrives over network
    const hostKeys = nobleKxServer(hostKp.publicKey, hostKp.privateKey, clientKp.publicKey);
    const approvalProof = computeApprovalProof(
      attempt.attemptId,
      'token-123',
      hostKp.publicKey,
      clientKp.publicKey,
      hostKeys.sharedTx
    );

    await MobilePairingService.handlePairStatus({
      approved: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'dev-host-001',
      approvalProof,
    });

    // Must remain unpaired
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
    expect(await SecureDeviceStore.getPairedHost()).toBeNull();
  });

  it('discards TERM_PAIR_RESP without attemptId', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;
    const hostKp = generateKeyPair();

    // Attacker sends TERM_PAIR_RESP without attemptId
    await MobilePairingService.handlePairResp({
      success: true,
      sessionToken: 'token-missing-attempt',
      hostPublicKey: toBase64(hostKp.publicKey),
    });

    // Attempt must remain in 'initiating'
    expect(useTerminalStore.getState().e2eeState).toBe('initiating');
    expect(MobilePairingService.getActiveAttempt()?.attemptId).toBe(attempt.attemptId);
  });

  it('discards TERM_PAIR_STATUS_RESP without attemptId or without sessionToken', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;
    const hostKp = generateKeyPair();
    const clientKp = (await SecureDeviceStore.getClientKeyPair())!;
    const computedSas = computeClientSas(
      hostKp.publicKey,
      clientKp.publicKey,
      '123456',
      attempt.attemptId,
      'token-123'
    );

    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      sas: computedSas,
    });

    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');

    const hostKeys = nobleKxServer(hostKp.publicKey, hostKp.privateKey, clientKp.publicKey);
    const approvalProof = computeApprovalProof(
      attempt.attemptId,
      'token-123',
      hostKp.publicKey,
      clientKp.publicKey,
      hostKeys.sharedTx
    );

    // 1. Missing attemptId
    await MobilePairingService.handlePairStatus({
      approved: true,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'dev-host-001',
      approvalProof,
    });
    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');

    // 2. Missing sessionToken
    await MobilePairingService.handlePairStatus({
      approved: true,
      attemptId: attempt.attemptId,
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'dev-host-001',
      approvalProof,
    });
    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');
  });

  it('requires explicit user SAS confirmation on phone before finalizing paired state', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;
    const hostKp = generateKeyPair();
    const clientKp = (await SecureDeviceStore.getClientKeyPair())!;
    const computedSas = computeClientSas(
      hostKp.publicKey,
      clientKp.publicKey,
      '123456',
      attempt.attemptId,
      'token-123'
    );

    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      sas: computedSas,
    });

    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');
    expect(useTerminalStore.getState().sasCode).toBe(computedSas);

    // Host approves first on laptop
    const hostKeys = nobleKxServer(hostKp.publicKey, hostKp.privateKey, clientKp.publicKey);
    const approvalProof = computeApprovalProof(
      attempt.attemptId,
      'token-123',
      hostKp.publicKey,
      clientKp.publicKey,
      hostKeys.sharedTx
    );

    await MobilePairingService.handlePairStatus({
      approved: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'dev-host-001',
      approvalProof,
    });

    // Mobile is STILL awaiting user confirmation (not automatically paired!)
    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');
    expect(await SecureDeviceStore.getPairedHost()).toBeNull();

    // Now user confirms SAS match on phone
    await MobilePairingService.confirmSasMatch();

    // Now state transitions to paired!
    expect(useTerminalStore.getState().e2eeState).toBe('paired');
    expect(await SecureDeviceStore.getPairedHost()).not.toBeNull();
  });

  it('rejects approval when cryptographic approvalProof is forged or invalid', async () => {
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt()!;
    const hostKp = generateKeyPair();
    const clientKp = (await SecureDeviceStore.getClientKeyPair())!;
    const computedSas = computeClientSas(
      hostKp.publicKey,
      clientKp.publicKey,
      '123456',
      attempt.attemptId,
      'token-123'
    );

    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      sas: computedSas,
    });

    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');

    // User confirms SAS match
    await MobilePairingService.confirmSasMatch();
    expect(useTerminalStore.getState().e2eeState).toBe('pending_approval');

    // Attacker sends forged approval proof
    await MobilePairingService.handlePairStatus({
      approved: true,
      attemptId: attempt.attemptId,
      sessionToken: 'token-123',
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'dev-host-001',
      approvalProof: toBase64(new Uint8Array(32)), // forged 32 zero bytes
    });

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('Invalid host approval confirmation proof');
    expect(await SecureDeviceStore.getPairedHost()).toBeNull();
  });

  it('preserves paired state on ordinary session error like INPUT_REJECTED', () => {
    const dummySession = new MobileE2EESession(
      'client',
      new Uint8Array(32),
      new Uint8Array(32),
      'epoch-1'
    );
    useTerminalStore.getState().setE2EESession(dummySession, 'dev-laptop-001');
    expect(useTerminalStore.getState().e2eeState).toBe('paired');

    // Routine terminal session error arrives via message dispatcher
    handleMessage(
      'TERM_ERROR',
      {
        code: 'INPUT_REJECTED',
        message: 'Terminal session is busy or buffer full',
      },
      'msg-err-1'
    );

    // E2EE paired state must NOT be wiped!
    expect(useTerminalStore.getState().e2eeState).toBe('paired');
    expect(useTerminalStore.getState().e2eeSession).not.toBeNull();
  });

  it('revokes pairing when DEVICE_NOT_APPROVED error arrives', () => {
    const dummySession = new MobileE2EESession(
      'client',
      new Uint8Array(32),
      new Uint8Array(32),
      'epoch-1'
    );
    useTerminalStore.getState().setE2EESession(dummySession, 'dev-laptop-001');
    expect(useTerminalStore.getState().e2eeState).toBe('paired');

    handleMessage(
      'TERM_ERROR',
      {
        code: 'DEVICE_NOT_APPROVED',
        message: 'Device pairing was revoked on host',
      },
      'msg-err-2'
    );

    // Pairing must be revoked
    expect(useTerminalStore.getState().e2eeState).toBe('error');
    expect(useTerminalStore.getState().e2eeSession).toBeNull();
  });
});
