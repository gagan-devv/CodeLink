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
import { MobilePairingService } from '../crypto/MobilePairingService';
import { handleMessage } from '../ws/MessageDispatcher';
import { wsManager } from '../ws/WsManager';
import { generateKeyPair, toBase64 } from '../crypto/nobleKx';

describe('Mobile Pairing Lifecycle & Error Handling (Stage A)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTerminalStore.getState().reset();
    MobilePairingService.cancelPairing();
  });

  afterEach(() => {
    MobilePairingService.cancelPairing();
    vi.useRealTimers();
  });

  it('rejects invalid pairing codes before sending', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    const sendSpy = vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    // Less than 6 digits
    await expect(MobilePairingService.initiatePairing('12345')).rejects.toThrow(
      'Pairing code must be exactly 6 digits'
    );
    // Non-numeric
    await expect(MobilePairingService.initiatePairing('abcdef')).rejects.toThrow(
      'Pairing code must be exactly 6 digits'
    );
    // More than 6 digits
    await expect(MobilePairingService.initiatePairing('1234567')).rejects.toThrow(
      'Pairing code must be exactly 6 digits'
    );

    expect(sendSpy).not.toHaveBeenCalled();
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
  });

  it('throws on disconnected socket without phantom initiating state', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(false);
    const sendSpy = vi.spyOn(wsManager, 'sendTerminal');

    await expect(MobilePairingService.initiatePairing('123456')).rejects.toThrow(
      'WebSocket is not connected. Reconnect to session before pairing.'
    );

    expect(sendSpy).not.toHaveBeenCalled();
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
  });

  it('handles legacy Go error payload {code, error} and displays actionable error', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    await MobilePairingService.initiatePairing('123456');
    expect(useTerminalStore.getState().e2eeState).toBe('initiating');

    // Simulate legacy Go frame with only `error` field
    handleMessage(
      'TERM_ERROR',
      {
        code: 'COMPANION_NOT_CONNECTED',
        error: 'Terminal companion daemon is not connected to this session',
      },
      'msg-1'
    );

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('COMPANION_NOT_CONNECTED');
    expect(state.e2eeError).toContain('codelink-terminal enable');
  });

  it('handles normalized error payload {code, message} and displays actionable error', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    await MobilePairingService.initiatePairing('123456');
    expect(useTerminalStore.getState().e2eeState).toBe('initiating');

    // Simulate normalized frame with `message` field
    handleMessage(
      'TERM_ERROR',
      {
        code: 'COMPANION_NOT_CONNECTED',
        message: 'Terminal companion daemon is not connected to this session',
      },
      'msg-2'
    );

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('COMPANION_NOT_CONNECTED');
    expect(state.e2eeError).toContain('codelink-terminal enable');
  });

  it('times out after 10s if companion does not respond to TERM_PAIR', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    await MobilePairingService.initiatePairing('123456');
    expect(useTerminalStore.getState().e2eeState).toBe('initiating');

    // Fast forward 10 seconds
    vi.advanceTimersByTime(10_000);

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('Pairing request timed out after 10 seconds');
  });

  it('times out approval polling after 5 minutes', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    const hostKp = generateKeyPair();
    await MobilePairingService.initiatePairing('123456');
    const attempt = MobilePairingService.getActiveAttempt();
    await MobilePairingService.handlePairResp({
      success: true,
      attemptId: attempt?.attemptId,
      sessionToken: 'token-test',
      hostPublicKey: toBase64(hostKp.publicKey),
    });

    expect(useTerminalStore.getState().e2eeState).toBe('awaiting_user_confirmation');

    // Advance 5 minutes + 1 interval
    vi.advanceTimersByTime(5 * 60 * 1000 + 2000);

    const state = useTerminalStore.getState();
    expect(state.e2eeState).toBe('error');
    expect(state.e2eeError).toContain('Pairing approval timed out after 5 minutes');
  });

  it('cancelPairing clears timers and resets state', async () => {
    vi.spyOn(wsManager, 'isConnected').mockReturnValue(true);
    vi.spyOn(wsManager, 'sendTerminal').mockReturnValue(true);

    await MobilePairingService.initiatePairing('123456');
    expect(useTerminalStore.getState().e2eeState).toBe('initiating');

    MobilePairingService.cancelPairing();

    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
    expect(useTerminalStore.getState().e2eeError).toBeNull();

    // Advancing timers should not cause a timeout error
    vi.advanceTimersByTime(15_000);
    expect(useTerminalStore.getState().e2eeState).toBe('unpaired');
  });
});
