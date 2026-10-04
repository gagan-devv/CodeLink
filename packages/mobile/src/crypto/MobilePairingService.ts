import {
  TerminalPairPayload,
  TerminalPairRespPayload,
  TerminalPairStatusRespPayload,
} from '@codelink/protocol';
import { wsManager } from '../ws/WsManager';
import { SecureDeviceStore } from './SecureDeviceStore';
import { toBase64, fromBase64, nobleKxClient, computeClientSas } from './nobleKx';
import { MobileE2EESession } from './MobileE2EESession';
import { useTerminalStore } from '../terminal/useTerminalStore';

export class MobilePairingService {
  private static pendingCode: string | null = null;
  private static pendingHostPublicKey: Uint8Array | null = null;
  private static pollTimer: NodeJS.Timeout | null = null;
  private static responseTimeoutTimer: NodeJS.Timeout | null = null;
  private static currentAttemptId = 0;

  public static readonly INITIAL_RESPONSE_TIMEOUT_MS = 10_000;
  public static readonly APPROVAL_POLL_TIMEOUT_MS = 5 * 60 * 1000;

  public static startApprovalPolling(
    sessionToken: string,
    intervalMs = 1500,
    maxDurationMs = MobilePairingService.APPROVAL_POLL_TIMEOUT_MS
  ): void {
    MobilePairingService.stopApprovalPolling();
    const pollAttemptId = MobilePairingService.currentAttemptId;
    const startTime = Date.now();

    MobilePairingService.pollTimer = setInterval(() => {
      if (pollAttemptId !== MobilePairingService.currentAttemptId) {
        MobilePairingService.stopApprovalPolling();
        return;
      }
      const state = useTerminalStore.getState();
      if (state.e2eeState !== 'pending_approval') {
        MobilePairingService.stopApprovalPolling();
        return;
      }
      if (Date.now() - startTime > maxDurationMs) {
        MobilePairingService.stopApprovalPolling();
        MobilePairingService.pendingCode = null;
        MobilePairingService.pendingHostPublicKey = null;
        useTerminalStore
          .getState()
          .setE2EEError('Pairing approval timed out after 5 minutes. Please try pairing again.');
        return;
      }
      try {
        wsManager.sendTerminal('TERM_PAIR_STATUS', { sessionToken });
      } catch (err) {
        MobilePairingService.stopApprovalPolling();
        const msg = err instanceof Error ? err.message : String(err);
        useTerminalStore
          .getState()
          .setE2EEError(`Connection error during approval polling: ${msg}`);
      }
    }, intervalMs);
  }

  public static stopApprovalPolling(): void {
    if (MobilePairingService.pollTimer) {
      clearInterval(MobilePairingService.pollTimer);
      MobilePairingService.pollTimer = null;
    }
  }

  public static stopResponseTimeout(): void {
    if (MobilePairingService.responseTimeoutTimer) {
      clearTimeout(MobilePairingService.responseTimeoutTimer);
      MobilePairingService.responseTimeoutTimer = null;
    }
  }

  public static cancelPairing(): void {
    MobilePairingService.currentAttemptId++;
    MobilePairingService.stopResponseTimeout();
    MobilePairingService.stopApprovalPolling();
    MobilePairingService.pendingCode = null;
    MobilePairingService.pendingHostPublicKey = null;
    useTerminalStore.getState().clearE2EE();
  }

  public static handleTermError(code: string, message: string): void {
    MobilePairingService.stopResponseTimeout();
    MobilePairingService.stopApprovalPolling();
    MobilePairingService.pendingCode = null;
    MobilePairingService.pendingHostPublicKey = null;

    if (code === 'COMPANION_NOT_CONNECTED') {
      useTerminalStore
        .getState()
        .setE2EEError(
          `[COMPANION_NOT_CONNECTED] ${message || 'Terminal companion daemon is not connected to this session'}. Please start/enable the companion service on your host machine ("codelink-terminal enable" or via VS Code status bar) and ensure it is attached.`
        );
    } else {
      useTerminalStore.getState().setE2EEError(`[${code}] ${message}`);
    }
  }

  public static async initiatePairing(
    code: string,
    hostPublicKeyBase64?: string,
    deviceName?: string
  ): Promise<void> {
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      throw new Error('Pairing code must be exactly 6 digits');
    }

    if (!wsManager.isConnected()) {
      throw new Error('WebSocket is not connected. Reconnect to session before pairing.');
    }

    MobilePairingService.currentAttemptId++;
    const attemptId = MobilePairingService.currentAttemptId;
    MobilePairingService.stopResponseTimeout();
    MobilePairingService.stopApprovalPolling();

    const keyPair = await SecureDeviceStore.getOrCreateClientKeyPair();
    MobilePairingService.pendingCode = trimmedCode;

    if (hostPublicKeyBase64) {
      MobilePairingService.pendingHostPublicKey = fromBase64(hostPublicKeyBase64);
    } else {
      MobilePairingService.pendingHostPublicKey = null;
    }

    useTerminalStore.getState().setPairingState('initiating');

    const payload: TerminalPairPayload = {
      code: trimmedCode,
      clientPublicKey: toBase64(keyPair.publicKey),
      clientDeviceName: deviceName || 'CodeLink Mobile',
    };

    // Start 10-second initial response timeout
    MobilePairingService.responseTimeoutTimer = setTimeout(() => {
      if (attemptId !== MobilePairingService.currentAttemptId) {
        return;
      }
      MobilePairingService.stopResponseTimeout();
      MobilePairingService.stopApprovalPolling();
      MobilePairingService.pendingCode = null;
      MobilePairingService.pendingHostPublicKey = null;
      useTerminalStore
        .getState()
        .setE2EEError(
          'Pairing request timed out after 10 seconds. No response from companion. Ensure companion daemon is running and attached, then retry.'
        );
    }, MobilePairingService.INITIAL_RESPONSE_TIMEOUT_MS);

    try {
      wsManager.sendTerminal('TERM_PAIR', payload);
    } catch (err) {
      MobilePairingService.stopResponseTimeout();
      MobilePairingService.pendingCode = null;
      MobilePairingService.pendingHostPublicKey = null;
      const msg = err instanceof Error ? err.message : String(err);
      useTerminalStore.getState().setE2EEError(`Failed to send pairing request: ${msg}`);
      throw err;
    }
  }

  public static async handlePairResp(resp: TerminalPairRespPayload): Promise<void> {
    MobilePairingService.stopResponseTimeout();

    if (!resp.success) {
      MobilePairingService.pendingCode = null;
      MobilePairingService.pendingHostPublicKey = null;
      MobilePairingService.stopApprovalPolling();
      useTerminalStore.getState().setE2EEError(resp.error || 'Pairing rejected');
      return;
    }

    if (resp.hostPublicKey) {
      try {
        MobilePairingService.pendingHostPublicKey = fromBase64(resp.hostPublicKey);
      } catch {
        MobilePairingService.stopApprovalPolling();
        useTerminalStore
          .getState()
          .setE2EEError('Malformed host public key received from pairing response');
        return;
      }
    }

    const keyPair = await SecureDeviceStore.getClientKeyPair();
    let localSas = resp.sas || '';

    // If host public key was provided (either via QR code or returned in pair response), verify SAS matches locally
    if (MobilePairingService.pendingHostPublicKey && keyPair && MobilePairingService.pendingCode) {
      const computedSas = computeClientSas(
        MobilePairingService.pendingHostPublicKey,
        keyPair.publicKey,
        MobilePairingService.pendingCode
      );
      if (resp.sas && resp.sas !== computedSas) {
        MobilePairingService.stopApprovalPolling();
        MobilePairingService.pendingCode = null;
        MobilePairingService.pendingHostPublicKey = null;
        useTerminalStore
          .getState()
          .setE2EEError('Security warning: SAS mismatch. Possible MITM attack.');
        return;
      }
      localSas = computedSas;
    }

    useTerminalStore.getState().setPendingApproval(resp.sessionToken || '', localSas);
    if (resp.sessionToken) {
      MobilePairingService.startApprovalPolling(resp.sessionToken);
    }
  }

  public static async handlePairStatus(status: TerminalPairStatusRespPayload): Promise<void> {
    if (!status.approved || !status.hostPublicKey || !status.deviceId) {
      if (status.error) {
        MobilePairingService.stopApprovalPolling();
        MobilePairingService.pendingCode = null;
        MobilePairingService.pendingHostPublicKey = null;
        useTerminalStore.getState().setE2EEError(status.error);
      }
      return;
    }

    MobilePairingService.stopApprovalPolling();

    const keyPair = await SecureDeviceStore.getClientKeyPair();
    if (!keyPair) {
      useTerminalStore.getState().setE2EEError('Client keypair missing during pairing completion');
      return;
    }

    // Verify host public key didn't change from initial SAS verification
    if (MobilePairingService.pendingHostPublicKey) {
      const expectedHostPubBase64 = toBase64(MobilePairingService.pendingHostPublicKey);
      if (status.hostPublicKey !== expectedHostPubBase64) {
        MobilePairingService.pendingCode = null;
        MobilePairingService.pendingHostPublicKey = null;
        useTerminalStore
          .getState()
          .setE2EEError('Security warning: Host public key changed during pairing approval.');
        return;
      }
    }

    let hostPublicKey: Uint8Array;
    try {
      hostPublicKey = fromBase64(status.hostPublicKey);
    } catch {
      useTerminalStore.getState().setE2EEError('Malformed host public key in approval response');
      return;
    }

    const sessionKeys = nobleKxClient(keyPair.publicKey, keyPair.privateKey, hostPublicKey);

    const session = new MobileE2EESession('client', sessionKeys.sharedTx, sessionKeys.sharedRx);

    await SecureDeviceStore.setPairedHost({
      hostPublicKey: status.hostPublicKey,
      deviceId: status.deviceId,
      pairedAt: Date.now(),
    });

    useTerminalStore.getState().setE2EESession(session, status.deviceId);
    MobilePairingService.pendingCode = null;
    MobilePairingService.pendingHostPublicKey = null;
  }

  public static async restoreSessionIfPaired(): Promise<boolean> {
    const [keyPair, pairedHost] = await Promise.all([
      SecureDeviceStore.getClientKeyPair(),
      SecureDeviceStore.getPairedHost(),
    ]);

    if (!keyPair || !pairedHost) {
      return false;
    }

    try {
      const hostPublicKey = fromBase64(pairedHost.hostPublicKey);
      const sessionKeys = nobleKxClient(keyPair.publicKey, keyPair.privateKey, hostPublicKey);
      const session = new MobileE2EESession('client', sessionKeys.sharedTx, sessionKeys.sharedRx);
      useTerminalStore.getState().setE2EESession(session, pairedHost.deviceId);
      return true;
    } catch (err) {
      console.warn('[MobilePairingService] Failed to restore paired session:', err);
      return false;
    }
  }

  public static async unpair(): Promise<void> {
    MobilePairingService.cancelPairing();
    await SecureDeviceStore.clearPairedHost();
    useTerminalStore.getState().clearE2EE();
  }
}
