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
import { generateKeyPair, toBase64 } from '../crypto/nobleKx';

describe('Settings Pairing Integration (Fix A)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTerminalStore.getState().reset();
    MobilePairingService.stopApprovalPolling();
  });

  afterEach(() => {
    MobilePairingService.stopApprovalPolling();
    vi.useRealTimers();
  });

  it('completes pairing from Settings, polls status, and transitions tab to visible upon host approval', async () => {
    const sendSpy = vi.spyOn(wsManager, 'sendTerminal').mockImplementation(() => {});

    // 1. Initial State: Unpaired with feature flag enabled
    const flagVal = 'true';
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
    expect(isTerminalTabVisible(useTerminalStore.getState().e2eeState, flagVal)).toBe(false);

    // 2. Settings initiates pairing with a 6-digit code
    await MobilePairingService.initiatePairing('654321');
    expect(useTerminalStore.getState().e2eeState).toBe('initiating');
    expect(sendSpy).toHaveBeenCalledWith('TERM_PAIR', expect.objectContaining({
      code: '654321',
      clientPublicKey: expect.any(String),
    }));

    // 3. Companion responds with pending approval and SAS code
    const mockSessionToken = 'session-token-xyz-123';
    const mockSas = '492019';
    await MobilePairingService.handlePairResp({
      success: true,
      sessionToken: mockSessionToken,
      sas: mockSas,
    });

    // State is pending approval with SAS displayed; Tab must still be HIDDEN
    expect(useTerminalStore.getState().e2eeState).toBe('pending_approval');
    expect(useTerminalStore.getState().sasCode).toBe(mockSas);
    expect(useTerminalStore.getState().sessionToken).toBe(mockSessionToken);
    expect(isTerminalTabVisible(useTerminalStore.getState().e2eeState, flagVal)).toBe(false);

    // 4. Verify approval polling ticks automatically in the background
    vi.advanceTimersByTime(1600);
    expect(sendSpy).toHaveBeenCalledWith('TERM_PAIR_STATUS', { sessionToken: mockSessionToken });

    vi.advanceTimersByTime(1500);
    expect(sendSpy).toHaveBeenCalledWith('TERM_PAIR_STATUS', { sessionToken: mockSessionToken });

    // 5. Host approves pairing on laptop, companion sends TERM_PAIR_STATUS_RESP
    const hostKp = generateKeyPair();
    const hostPublicKeyBase64 = toBase64(hostKp.publicKey);

    await MobilePairingService.handlePairStatus({
      approved: true,
      hostPublicKey: hostPublicKeyBase64,
      deviceId: 'laptop-host-device-001',
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
