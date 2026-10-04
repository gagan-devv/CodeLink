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

  public static startApprovalPolling(sessionToken: string, intervalMs = 1500): void {
    MobilePairingService.stopApprovalPolling();
    MobilePairingService.pollTimer = setInterval(() => {
      const state = useTerminalStore.getState();
      if (state.e2eeState !== 'pending_approval') {
        MobilePairingService.stopApprovalPolling();
        return;
      }
      wsManager.sendTerminal('TERM_PAIR_STATUS', { sessionToken });
    }, intervalMs);
  }

  public static stopApprovalPolling(): void {
    if (MobilePairingService.pollTimer) {
      clearInterval(MobilePairingService.pollTimer);
      MobilePairingService.pollTimer = null;
    }
  }

  public static async initiatePairing(
    code: string,
    hostPublicKeyBase64?: string,
    deviceName?: string
  ): Promise<void> {
    const keyPair = await SecureDeviceStore.getOrCreateClientKeyPair();
    MobilePairingService.pendingCode = code;

    if (hostPublicKeyBase64) {
      MobilePairingService.pendingHostPublicKey = fromBase64(hostPublicKeyBase64);
    }

    useTerminalStore.getState().setPairingState('initiating');

    const payload: TerminalPairPayload = {
      code,
      clientPublicKey: toBase64(keyPair.publicKey),
      clientDeviceName: deviceName || 'CodeLink Mobile',
    };

    wsManager.sendTerminal('TERM_PAIR', payload);
  }

  public static async handlePairResp(resp: TerminalPairRespPayload): Promise<void> {
    if (!resp.success) {
      MobilePairingService.pendingCode = null;
      MobilePairingService.pendingHostPublicKey = null;
      MobilePairingService.stopApprovalPolling();
      useTerminalStore.getState().setE2EEError(resp.error || 'Pairing rejected');
      return;
    }

    const keyPair = await SecureDeviceStore.getClientKeyPair();
    let localSas = resp.sas || '';

    // If host public key was provided (e.g. from QR code), verify SAS matches locally
    if (MobilePairingService.pendingHostPublicKey && keyPair && MobilePairingService.pendingCode) {
      const computedSas = computeClientSas(
        MobilePairingService.pendingHostPublicKey,
        keyPair.publicKey,
        MobilePairingService.pendingCode
      );
      if (resp.sas && resp.sas !== computedSas) {
        MobilePairingService.stopApprovalPolling();
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

    const hostPublicKey = fromBase64(status.hostPublicKey);
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
    MobilePairingService.stopApprovalPolling();
    await SecureDeviceStore.clearPairedHost();
    useTerminalStore.getState().clearE2EE();
  }
}
