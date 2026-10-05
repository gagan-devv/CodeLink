import {
  TerminalPairPayload,
  TerminalPairRespPayload,
  TerminalPairStatusRespPayload,
} from '@codelink/protocol';
import { wsManager } from '../ws/WsManager';
import { SecureDeviceStore } from './SecureDeviceStore';
import {
  toBase64,
  fromBase64,
  toHex,
  nobleKxClient,
  computeClientSas,
  computeApprovalProof,
  compareBytesConstantTime,
} from './nobleKx';
import { secureRandomBytes } from './random';
import { MobileE2EESession } from './MobileE2EESession';
import { useTerminalStore } from '../terminal/useTerminalStore';

export interface ActivePairingAttempt {
  attemptId: string;
  code: string;
  expectedHostPublicKey: Uint8Array | null;
  candidateHostPublicKey: Uint8Array | null;
  sessionToken: string | null;
  sas: string | null;
  state: 'initiating' | 'awaiting_user_confirmation' | 'pending_approval';
  userConfirmedSas: boolean;
  pendingApprovedStatus: TerminalPairStatusRespPayload | null;
  createdAt: number;
}

export class MobilePairingService {
  private static activeAttempt: ActivePairingAttempt | null = null;
  private static pollTimer: NodeJS.Timeout | null = null;
  private static responseTimeoutTimer: NodeJS.Timeout | null = null;
  private static pendingAttachClientNonce: string | null = null;

  public static readonly INITIAL_RESPONSE_TIMEOUT_MS = 10_000;
  public static readonly APPROVAL_POLL_TIMEOUT_MS = 5 * 60 * 1000;

  public static getActiveAttempt(): ActivePairingAttempt | null {
    return MobilePairingService.activeAttempt;
  }

  public static getPendingAttachClientNonce(): string | null {
    return MobilePairingService.pendingAttachClientNonce;
  }

  public static clearPendingAttachClientNonce(): void {
    MobilePairingService.pendingAttachClientNonce = null;
  }

  public static sendAttach(
    sessionId = '',
    requestedMode: 'observe' | 'control' = 'observe',
    lastOffset?: number
  ): void {
    const clientNonceBytes = secureRandomBytes(16);
    const clientNonce = toHex(clientNonceBytes);
    MobilePairingService.pendingAttachClientNonce = clientNonce;

    const deviceId = useTerminalStore.getState().deviceId;
    wsManager.sendTerminal('TERM_ATTACH', {
      sessionId,
      requestedMode,
      lastOffset,
      deviceId: deviceId || undefined,
      clientNonce,
    });
  }

  public static startApprovalPolling(
    attemptId: string,
    sessionToken: string,
    intervalMs = 1500,
    maxDurationMs = MobilePairingService.APPROVAL_POLL_TIMEOUT_MS
  ): void {
    MobilePairingService.stopApprovalPolling();
    const startTime = Date.now();

    MobilePairingService.pollTimer = setInterval(() => {
      const attempt = MobilePairingService.activeAttempt;
      if (
        !attempt ||
        attempt.attemptId !== attemptId ||
        (attempt.state !== 'awaiting_user_confirmation' && attempt.state !== 'pending_approval')
      ) {
        MobilePairingService.stopApprovalPolling();
        return;
      }

      const state = useTerminalStore.getState();
      if (
        state.e2eeState !== 'awaiting_user_confirmation' &&
        state.e2eeState !== 'pending_approval'
      ) {
        MobilePairingService.stopApprovalPolling();
        return;
      }

      if (Date.now() - startTime > maxDurationMs) {
        MobilePairingService.cancelPairing();
        useTerminalStore
          .getState()
          .setE2EEError('Pairing approval timed out after 5 minutes. Please try pairing again.');
        return;
      }

      try {
        wsManager.sendTerminal('TERM_PAIR_STATUS', { attemptId, sessionToken });
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
    MobilePairingService.activeAttempt = null;
    MobilePairingService.stopResponseTimeout();
    MobilePairingService.stopApprovalPolling();
    useTerminalStore.getState().clearE2EE();
  }

  public static handleTermError(code: string, message: string): void {
    // Only handle terminal errors that are pairing-relevant or occur during an active pairing lifecycle
    const attempt = MobilePairingService.activeAttempt;
    const currentState = useTerminalStore.getState().e2eeState;

    if (code === 'DEVICE_NOT_APPROVED' || code === 'PAIRING_REVOKED') {
      MobilePairingService.cancelPairing();
      SecureDeviceStore.clearPairedHost().catch(() => {});
      useTerminalStore
        .getState()
        .setE2EEError(`[${code}] Device pairing was revoked or refused by host companion.`);
      return;
    }

    if (code === 'COMPANION_NOT_CONNECTED') {
      if (currentState === 'initiating' || currentState === 'pending_approval' || attempt) {
        MobilePairingService.cancelPairing();
        useTerminalStore
          .getState()
          .setE2EEError(
            `[COMPANION_NOT_CONNECTED] ${message || 'Terminal companion daemon is not connected to this session'}. Please start/enable the companion service on your host machine ("codelink-terminal enable" or via VS Code status bar) and ensure it is attached.`
          );
      }
      return;
    }

    // If currently initiating or pending approval, terminate pairing attempt on error
    if (attempt) {
      MobilePairingService.cancelPairing();
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

    // Cancel any previous attempt
    MobilePairingService.cancelPairing();

    let expectedHostPublicKey: Uint8Array | null = null;
    if (hostPublicKeyBase64) {
      try {
        expectedHostPublicKey = fromBase64(hostPublicKeyBase64);
        if (expectedHostPublicKey.length !== 32) {
          throw new Error('Expected 32-byte host public key');
        }
      } catch (err) {
        throw new Error(
          `Invalid trusted host public key: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const attemptId = toHex(secureRandomBytes(16));
    const attempt: ActivePairingAttempt = {
      attemptId,
      code: trimmedCode,
      expectedHostPublicKey,
      candidateHostPublicKey: null,
      sessionToken: null,
      sas: null,
      state: 'initiating',
      userConfirmedSas: false,
      pendingApprovedStatus: null,
      createdAt: Date.now(),
    };
    MobilePairingService.activeAttempt = attempt;

    useTerminalStore.getState().setPairingState('initiating');

    let keyPair;
    try {
      keyPair = await SecureDeviceStore.getOrCreateClientKeyPair();
    } catch (err) {
      MobilePairingService.cancelPairing();
      const msg = err instanceof Error ? err.message : String(err);
      useTerminalStore.getState().setE2EEError(`Failed to load device keypair: ${msg}`);
      throw err;
    }

    // Verify attempt wasn't cancelled while loading keypair
    if (
      !MobilePairingService.activeAttempt ||
      MobilePairingService.activeAttempt.attemptId !== attemptId
    ) {
      return;
    }

    const payload: TerminalPairPayload = {
      attemptId,
      code: trimmedCode,
      clientPublicKey: toBase64(keyPair.publicKey),
      clientDeviceName: deviceName || 'CodeLink Mobile',
    };

    // Start 10-second initial response timeout
    MobilePairingService.responseTimeoutTimer = setTimeout(() => {
      if (
        !MobilePairingService.activeAttempt ||
        MobilePairingService.activeAttempt.attemptId !== attemptId
      ) {
        return;
      }
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError(
          'Pairing request timed out after 10 seconds. No response from companion. Ensure companion daemon is running and attached, then retry.'
        );
    }, MobilePairingService.INITIAL_RESPONSE_TIMEOUT_MS);

    try {
      wsManager.sendTerminal('TERM_PAIR', payload);
    } catch (err) {
      MobilePairingService.cancelPairing();
      const msg = err instanceof Error ? err.message : String(err);
      useTerminalStore.getState().setE2EEError(`Failed to send pairing request: ${msg}`);
      throw err;
    }
  }

  public static async handlePairResp(resp: TerminalPairRespPayload): Promise<void> {
    const attempt = MobilePairingService.activeAttempt;
    if (
      !attempt ||
      attempt.state !== 'initiating' ||
      !resp.attemptId ||
      resp.attemptId !== attempt.attemptId
    ) {
      // Discard missing, stale or unsolicited response
      return;
    }

    MobilePairingService.stopResponseTimeout();

    if (!resp.success) {
      MobilePairingService.cancelPairing();
      useTerminalStore.getState().setE2EEError(resp.error || 'Pairing rejected by host companion');
      return;
    }

    if (!resp.sessionToken || typeof resp.sessionToken !== 'string') {
      MobilePairingService.cancelPairing();
      useTerminalStore.getState().setE2EEError('Malformed pairing response: missing session token');
      return;
    }

    if (!resp.hostPublicKey || typeof resp.hostPublicKey !== 'string') {
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError('Malformed pairing response: missing candidate host public key');
      return;
    }

    let hostPublicKeyBytes: Uint8Array;
    try {
      hostPublicKeyBytes = fromBase64(resp.hostPublicKey);
      if (hostPublicKeyBytes.length !== 32) {
        MobilePairingService.cancelPairing();
        useTerminalStore
          .getState()
          .setE2EEError('Malformed host public key received (expected 32 bytes)');
        return;
      }
    } catch {
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError('Malformed host public key received from pairing response');
      return;
    }

    // If an out-of-band host key was provided (e.g. from QR code), enforce exact match
    if (attempt.expectedHostPublicKey) {
      if (!compareBytesConstantTime(hostPublicKeyBytes, attempt.expectedHostPublicKey)) {
        MobilePairingService.cancelPairing();
        useTerminalStore
          .getState()
          .setE2EEError(
            'Security warning: Candidate host public key does not match trusted key from QR code.'
          );
        return;
      }
    }

    const keyPair = await SecureDeviceStore.getClientKeyPair();
    // Guard against cancellation during async read
    if (
      !MobilePairingService.activeAttempt ||
      MobilePairingService.activeAttempt.attemptId !== attempt.attemptId
    ) {
      return;
    }

    if (!keyPair) {
      MobilePairingService.cancelPairing();
      useTerminalStore.getState().setE2EEError('Client keypair missing during SAS verification');
      return;
    }

    // Compute SAS locally from (hostPublicKey, clientPublicKey, pairingCode, attemptId, sessionToken)
    const computedSas = computeClientSas(
      hostPublicKeyBytes,
      keyPair.publicKey,
      attempt.code,
      attempt.attemptId,
      resp.sessionToken
    );
    if (resp.sas && resp.sas !== computedSas) {
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError('Security warning: SAS mismatch. Possible MITM attack.');
      return;
    }

    // Transition to awaiting_user_confirmation state
    attempt.state = 'awaiting_user_confirmation';
    attempt.sessionToken = resp.sessionToken;
    attempt.candidateHostPublicKey = hostPublicKeyBytes;
    attempt.sas = computedSas;
    attempt.userConfirmedSas = false;

    useTerminalStore.getState().setAwaitingUserConfirmation(resp.sessionToken, computedSas);
    MobilePairingService.startApprovalPolling(attempt.attemptId, resp.sessionToken);
  }

  public static async confirmSasMatch(): Promise<void> {
    const attempt = MobilePairingService.activeAttempt;
    if (
      !attempt ||
      (attempt.state !== 'awaiting_user_confirmation' && attempt.state !== 'pending_approval')
    ) {
      return;
    }

    attempt.userConfirmedSas = true;

    if (attempt.pendingApprovedStatus) {
      const pendingStatus = attempt.pendingApprovedStatus;
      attempt.pendingApprovedStatus = null;
      await MobilePairingService.finalizePairing(pendingStatus);
    } else {
      attempt.state = 'pending_approval';
      useTerminalStore.getState().setPendingApproval(attempt.sessionToken!, attempt.sas || '');
    }
  }

  public static async handlePairStatus(status: TerminalPairStatusRespPayload): Promise<void> {
    const attempt = MobilePairingService.activeAttempt;
    if (
      !attempt ||
      (attempt.state !== 'awaiting_user_confirmation' && attempt.state !== 'pending_approval') ||
      !status.attemptId ||
      status.attemptId !== attempt.attemptId ||
      !status.sessionToken ||
      status.sessionToken !== attempt.sessionToken
    ) {
      // Discard missing, stale or unsolicited approval status
      return;
    }

    if (!status.approved) {
      if (status.error) {
        MobilePairingService.cancelPairing();
        useTerminalStore.getState().setE2EEError(status.error);
      }
      return;
    }

    if (!attempt.userConfirmedSas) {
      attempt.pendingApprovedStatus = status;
      return;
    }

    await MobilePairingService.finalizePairing(status);
  }

  private static async finalizePairing(status: TerminalPairStatusRespPayload): Promise<void> {
    const attempt = MobilePairingService.activeAttempt;
    if (!attempt) return;

    MobilePairingService.stopApprovalPolling();

    if (!status.hostPublicKey || !status.deviceId) {
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError('Malformed approval response: missing host public key or device ID');
      return;
    }

    let hostPublicKeyBytes: Uint8Array;
    try {
      hostPublicKeyBytes = fromBase64(status.hostPublicKey);
      if (hostPublicKeyBytes.length !== 32) {
        MobilePairingService.cancelPairing();
        useTerminalStore
          .getState()
          .setE2EEError('Invalid host public key length in approval response');
        return;
      }
    } catch {
      MobilePairingService.cancelPairing();
      useTerminalStore.getState().setE2EEError('Malformed host public key in approval response');
      return;
    }

    // Verify host public key matches candidate host key authenticated via SAS
    if (
      attempt.candidateHostPublicKey &&
      !compareBytesConstantTime(hostPublicKeyBytes, attempt.candidateHostPublicKey)
    ) {
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError('Security warning: Host public key changed during pairing approval.');
      return;
    }

    // Verify host approval cryptographic proof
    if (!status.approvalProof) {
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError(
          'Security warning: Host approval missing cryptographic confirmation proof. Refusing unauthenticated approval.'
        );
      return;
    }

    const keyPair = await SecureDeviceStore.getClientKeyPair();
    // Guard against cancellation during async read
    if (
      !MobilePairingService.activeAttempt ||
      MobilePairingService.activeAttempt.attemptId !== attempt.attemptId
    ) {
      return;
    }

    if (!keyPair) {
      MobilePairingService.cancelPairing();
      useTerminalStore.getState().setE2EEError('Client keypair missing during pairing completion');
      return;
    }

    const sessionKeys = nobleKxClient(keyPair.publicKey, keyPair.privateKey, hostPublicKeyBytes);
    const expectedProof = computeApprovalProof(
      attempt.attemptId,
      attempt.sessionToken || '',
      hostPublicKeyBytes,
      keyPair.publicKey,
      sessionKeys.sharedRx
    );

    const statusProofBytes = fromBase64(status.approvalProof);
    const expectedProofBytes = fromBase64(expectedProof);
    if (!compareBytesConstantTime(statusProofBytes, expectedProofBytes)) {
      MobilePairingService.cancelPairing();
      useTerminalStore
        .getState()
        .setE2EEError(
          'Security warning: Invalid host approval confirmation proof. Refusing unauthenticated approval.'
        );
      return;
    }

    // Save to secure device store
    try {
      await SecureDeviceStore.setPairedHost({
        hostPublicKey: status.hostPublicKey,
        deviceId: status.deviceId,
        pairedAt: Date.now(),
      });
    } catch (err) {
      MobilePairingService.cancelPairing();
      const msg = err instanceof Error ? err.message : String(err);
      useTerminalStore.getState().setE2EEError(`Failed to save paired device key: ${msg}`);
      return;
    }

    // Guard again after async write
    if (
      !MobilePairingService.activeAttempt ||
      MobilePairingService.activeAttempt.attemptId !== attempt.attemptId
    ) {
      // Reverted or cancelled while saving: purge stored state to prevent resurrection
      await SecureDeviceStore.clearPairedHost().catch(() => {});
      return;
    }

    // Note: Session is instantiated without an epoch; epoch is established via nonces on attach
    const session = new MobileE2EESession('client', sessionKeys.sharedTx, sessionKeys.sharedRx);

    useTerminalStore.getState().setE2EESession(session, status.deviceId);
    MobilePairingService.activeAttempt = null;

    // Immediately send attach with clientNonce to establish connection epoch
    if (wsManager.isConnected()) {
      try {
        MobilePairingService.sendAttach('', 'observe');
      } catch {
        // ignore
      }
    }
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
      // Restored session has no epoch until connection/attach nonces are exchanged
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
