import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
import { isTerminalTabVisible } from './terminalGating';
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

describe('Settings Pairing Integration (Fix A)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTerminalStore.getState().reset();
    MobilePairingService.cancelPairing();
  });

  afterEach(() => {
    MobilePairingService.cancelPairing();
    vi.useRealTimers();
  });

  it('completes pairing from Settings, polls status, and transitions tab to visible upon host approval', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    const sendSpy = vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    // 1. Initial State: Unpaired with feature flag enabled
    const flagVal = 'true';
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
    expect(isTerminalTabVisible(useTerminalStore.getState().e2eeState, flagVal)).toBe(false);

    // 2. Settings initiates pairing with a 6-digit code
    await MobilePairingService.initiatePairing('654321');
    expect(useTerminalStore.getState().e2eeState).toBe('initiating');
    expect(sendSpy).toHaveBeenCalledWith(
      'TERM_PAIR',
      expect.objectContaining({
        code: '654321',
        clientPublicKey: expect.any(String),
      })
    );

    const attempt = MobilePairingService.getActiveAttempt()!;
    expect(attempt).not.toBeNull();

    const hostKp = generateKeyPair();
    const clientKp = (await SecureDeviceStore.getClientKeyPair())!;
    const mockSessionToken = 'session-token-xyz-123';
    const computedSas = computeClientSas(
      hostKp.publicKey,
      clientKp.publicKey,
      '654321',
      attempt.attemptId,
      mockSessionToken
    );

    // 3. Companion responds with pending approval, hostPublicKey and computed SAS
    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt.attemptId,
      sessionToken: mockSessionToken,
      sas: computedSas,
      hostPublicKey: toBase64(hostKp.publicKey),
    });

    // State is awaiting user confirmation with SAS displayed; Tab must still be HIDDEN
    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');
    expect(useTerminalStore.getState().sasCode).toBe(computedSas);
    expect(useTerminalStore.getState().sessionToken).toBe(mockSessionToken);
    expect(isTerminalTabVisible(useTerminalStore.getState().e2eeState, flagVal)).toBe(false);

    // User confirms SAS match on mobile device
    await MobilePairingService.confirmSasMatch();
    expect(useTerminalStore.getState().e2eeState).toBe('pending_approval');

    // 4. Verify approval polling ticks automatically in the background
    vi.advanceTimersByTime(1600);
    expect(sendSpy).toHaveBeenCalledWith('TERM_PAIR_STATUS', {
      attemptId: attempt.attemptId,
      sessionToken: mockSessionToken,
    });

    vi.advanceTimersByTime(1500);
    expect(sendSpy).toHaveBeenCalledWith('TERM_PAIR_STATUS', {
      attemptId: attempt.attemptId,
      sessionToken: mockSessionToken,
    });

    // 5. Host approves pairing on laptop, companion derives server session keys & computes approvalProof
    const hostServerKeys = nobleKxServer(hostKp.publicKey, hostKp.privateKey, clientKp.publicKey);
    const approvalProof = computeApprovalProof(
      attempt.attemptId,
      mockSessionToken,
      hostKp.publicKey,
      clientKp.publicKey,
      hostServerKeys.sharedTx
    );

    await MobilePairingService.handlePairStatus({
      approved: true,
      attemptId: attempt.attemptId,
      sessionToken: mockSessionToken,
      hostPublicKey: toBase64(hostKp.publicKey),
      deviceId: 'laptop-host-device-001',
      approvalProof,
    });

    // 6. Verification: State transitions to 'paired', session established, tab becomes VISIBLE!
    expect(useTerminalStore.getState().e2eeState).toBe('paired');
    expect(useTerminalStore.getState().e2eeSession).not.toBeNull();
    expect(useTerminalStore.getState().deviceId).toBe('laptop-host-device-001');

    // Tab is now visible!
    expect(isTerminalTabVisible(useTerminalStore.getState().e2eeState, flagVal)).toBe(true);

    // Polling must be stopped after approval
    sendSpy.mockClear();
    vi.advanceTimersByTime(3000);
    expect(sendSpy).not.toHaveBeenCalledWith('TERM_PAIR_STATUS', expect.anything());

    sendSpy.mockRestore();
  });
});
