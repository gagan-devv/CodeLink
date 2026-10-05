import WebSocket from 'ws';
import sodium from 'libsodium-wrappers';
import {
  buildTerminalEnvelope,
  parseTerminalEnvelope,
  TerminalEnvelope,
  TerminalMessageType,
  TerminalPayloadFor,
  TerminalAttachPayload,
  TerminalInputPayload,
  TerminalResizePayload,
  TerminalDetachPayload,
  TerminalCloseSessionPayload,
  TerminalKillPayload,
  TerminalHandshakePayload,
  TerminalPairPayload,
  TerminalPairStatusPayload,
  EncryptedPacket,
} from '@codelink/protocol';
import { CompanionConfig } from '../service/CompanionConfig';
import { SessionTable, TerminalSession } from '../session/SessionTable';
import { PairingManager, KeyPair } from '../crypto/PairingManager';
import { PairedDeviceStore } from '../auth/PairedDeviceStore';
import { E2EESession, computeEpoch } from '../crypto/E2EESession';
import { InputDeduplicator } from './InputDeduplicator';
import { ReattachHandler } from './ReattachHandler';

export interface RelayClientOptions {
  relayUrl: string;
  token: string | (() => Promise<string> | string);
  config: CompanionConfig;
  sessionTable: SessionTable;
  pairingManager?: PairingManager;
  deviceStore?: PairedDeviceStore;
  hostKeyPair?: KeyPair;
  requireE2EE?: boolean;
  defaultDeviceId?: string;
  relaySessionId?: string;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectBackoffFactor?: number;
  maxReconnectAttempts?: number;
  onConnected?: () => void;
  onDisconnected?: (code?: number, reason?: string) => void;
  onError?: (err: Error) => void;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private outputSeq = 0;
  private inputDeduplicator = new InputDeduplicator();
  private isExplicitlyClosed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private sessionDisposables = new Map<string, { dispose: () => void }>();
  private activeDeviceId: string;
  private relayConnectionId?: string;
  private deviceStore?: PairedDeviceStore;
  private hostKeyPair?: KeyPair;
  private requireE2EE: boolean;
  private e2eeSessions = new Map<string, E2EESession>();

  constructor(private options: RelayClientOptions) {
    this.activeDeviceId = options.defaultDeviceId || 'remote-client';
    this.requireE2EE = options.requireE2EE ?? options.deviceStore !== undefined;
    this.deviceStore =
      options.deviceStore ||
      (this.requireE2EE ? options.pairingManager?.getDeviceStore() : undefined);
    this.hostKeyPair = options.hostKeyPair || options.pairingManager?.getHostKeyPair();
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getSessionTable(): SessionTable {
    return this.options.sessionTable;
  }

  public getPairingManager(): PairingManager | undefined {
    return this.options.pairingManager;
  }

  public getActiveDeviceId(): string {
    return this.activeDeviceId;
  }

  public setActiveDeviceId(deviceId: string): void {
    this.activeDeviceId = deviceId;
  }

  public getRelayConnectionId(): string | undefined {
    return this.relayConnectionId;
  }

  public getOrCreateE2EESession(deviceId: string, epoch?: string): E2EESession | null {
    if (this.e2eeSessions.has(deviceId)) {
      const existing = this.e2eeSessions.get(deviceId)!;
      if (epoch) {
        existing.setEpoch(epoch);
      }
      return existing;
    }

    if (!this.deviceStore || !this.hostKeyPair) {
      return null;
    }

    const device = this.deviceStore.getDevice(deviceId);
    if (!device || device.revoked) {
      return null;
    }

    try {
      const clientPubKey = sodium.from_base64(device.publicKey);
      const kxKeys = sodium.crypto_kx_server_session_keys(
        this.hostKeyPair.publicKey,
        this.hostKeyPair.privateKey,
        clientPubKey
      );
      const session = new E2EESession('host', kxKeys.sharedTx, kxKeys.sharedRx, epoch);
      this.e2eeSessions.set(deviceId, session);
      return session;
    } catch {
      return null;
    }
  }

  public registerE2EESession(deviceId: string, session: E2EESession): void {
    this.e2eeSessions.set(deviceId, session);
  }

  public getE2EESession(deviceId: string): E2EESession | undefined {
    return this.e2eeSessions.get(deviceId);
  }

  public sendOutput(sessionId: string, data: string, deviceId?: string): void {
    const targetDevId = deviceId || this.activeDeviceId;
    const session = this.getOrCreateE2EESession(targetDevId);

    let outputData = data;
    if (session) {
      const packet = session.encrypt(data);
      outputData = JSON.stringify(packet);
    }

    this.sendTerminalEnvelope('TERM_OUTPUT', {
      sessionId,
      seq: ++this.outputSeq,
      data: outputData,
    });
  }

  public async connect(): Promise<void> {
    // Feature gate check: do nothing unless CompanionConfig.enabled is true
    if (!this.options.config.isEnabled()) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isExplicitlyClosed = false;

    const token =
      typeof this.options.token === 'function' ? await this.options.token() : this.options.token;

    // Relay currently accepts authentication via query string `?token=<jwt>`
    let wsUrl = this.options.relayUrl;
    const sep = wsUrl.includes('?') ? '&' : '?';
    wsUrl = `${wsUrl}${sep}token=${encodeURIComponent(token)}`;

    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.on('open', () => {
          this.reconnectAttempt = 0;
          this.options.onConnected?.();
          if (!resolved) {
            resolved = true;
            resolve();
          }
        });

        ws.on('message', async (data: WebSocket.RawData) => {
          const raw = typeof data === 'string' ? data : data.toString('utf8');
          await this.handleMessage(raw);
        });

        ws.on('close', (code, reason) => {
          const reasonStr = reason ? reason.toString('utf8') : '';
          this.cleanupSessionSubscriptions();
          this.ws = null;
          this.options.onDisconnected?.(code, reasonStr);

          if (!this.isExplicitlyClosed && this.options.config.isEnabled()) {
            this.scheduleReconnect();
          }
        });

        ws.on('error', (err) => {
          this.options.onError?.(err);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
      } catch (err) {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSessionSubscriptions();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public sendTerminalEnvelope<T extends TerminalMessageType>(
    type: T,
    payload: TerminalPayloadFor<T>
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const envelope = buildTerminalEnvelope(type, payload);
    this.ws.send(JSON.stringify(envelope));
  }

  public async handleMessage(raw: string): Promise<void> {
    const envelope = parseTerminalEnvelope(raw);
    if (!envelope) {
      // Check if it's a relay protocol message (HANDSHAKE_ACK or SESSION_REVOKED)
      try {
        const json = JSON.parse(raw);
        if (json.type === 'HANDSHAKE_ACK') {
          this.relayConnectionId = json.payload?.connectionID;
          return;
        }
        if (json.type === 'SESSION_REVOKED') {
          this.disconnect();
          return;
        }
      } catch {
        // Not valid JSON, ignore
      }
      return;
    }

    await this.routeTerminalEnvelope(envelope);
  }

  private async routeTerminalEnvelope(envelope: TerminalEnvelope): Promise<void> {
    switch (envelope.type) {
      case 'TERM_ATTACH': {
        const payload = envelope.payload as TerminalAttachPayload;
        const deviceId =
          payload.deviceId ||
          ((payload as unknown as Record<string, unknown>).deviceId as string) ||
          this.activeDeviceId;

        if (this.requireE2EE && this.deviceStore && !this.deviceStore.isApproved(deviceId)) {
          this.sendTerminalEnvelope('TERM_ERROR', {
            code: 'DEVICE_NOT_APPROVED',
            message: 'Device is not approved or pairing was revoked',
            sessionId: payload.sessionId,
          });
          return;
        }

        let hostNonceHex: string | undefined;
        let derivedEpoch: string | undefined;

        if (deviceId && payload.clientNonce && this.hostKeyPair) {
          const e2eeSession = this.getOrCreateE2EESession(deviceId);
          if (e2eeSession) {
            const hostNonceBytes = sodium.randombytes_buf(16);
            hostNonceHex = sodium.to_hex(hostNonceBytes);
            derivedEpoch = computeEpoch(payload.clientNonce, hostNonceHex);
            e2eeSession.setEpoch(derivedEpoch);
            this.activeDeviceId = deviceId;
          }
        }

        let session = this.options.sessionTable.get(payload.sessionId);
        if (!session) {
          try {
            session = this.options.sessionTable.createSession(payload.sessionId);
          } catch (err) {
            this.sendTerminalEnvelope('TERM_ERROR', {
              code: 'SESSION_NOT_FOUND',
              message: err instanceof Error ? err.message : String(err),
              sessionId: payload.sessionId,
            });
            return;
          }
        }

        const attachResult = this.options.sessionTable.attachDevice(
          payload.sessionId,
          deviceId,
          payload.requestedMode
        );

        const reattachHandler = new ReattachHandler(session.ringBuffer);
        const reattachResult = reattachHandler.handleReattach(
          payload.sessionId,
          payload.lastOffset ?? 0
        );

        // Send TERM_ATTACH_RESP back with fresh hostNonce and derived connection epoch
        this.sendTerminalEnvelope('TERM_ATTACH_RESP', {
          sessionId: payload.sessionId,
          mode: attachResult.mode,
          cols: session.pty.cols,
          rows: session.pty.rows,
          startOffset: payload.lastOffset ?? 0,
          hasGap: reattachResult.hasGap,
          hostNonce: hostNonceHex,
          epoch: derivedEpoch,
        });

        if (reattachResult.hasGap && reattachResult.gapNotice) {
          this.sendTerminalEnvelope('TERM_GAP', reattachResult.gapNotice);
        }

        if (reattachResult.data && reattachResult.data.length > 0) {
          this.sendOutput(payload.sessionId, reattachResult.data, deviceId);
        }

        this.subscribeSessionOutput(payload.sessionId, session);
        break;
      }

      case 'TERM_INPUT': {
        const payload = envelope.payload as TerminalInputPayload;
        const deviceId =
          ((payload as unknown as Record<string, unknown>).deviceId as string) ||
          this.activeDeviceId;

        const isE2EERequired = this.requireE2EE || this.e2eeSessions.has(deviceId);

        // If E2EE or device store is in use, verify approval
        if (this.deviceStore) {
          if (!this.deviceStore.isApproved(deviceId)) {
            this.sendTerminalEnvelope('TERM_ERROR', {
              code: 'DEVICE_NOT_APPROVED',
              message: 'Device is not approved or pairing was revoked',
              sessionId: payload.sessionId,
            });
            return;
          }
        } else if (this.requireE2EE) {
          this.sendTerminalEnvelope('TERM_ERROR', {
            code: 'DEVICE_NOT_APPROVED',
            message: 'Device is not approved or device store missing',
            sessionId: payload.sessionId,
          });
          return;
        }

        let inputData = payload.data;

        if (isE2EERequired) {
          const e2eeSession = this.getOrCreateE2EESession(deviceId);
          if (!e2eeSession) {
            this.sendTerminalEnvelope('TERM_ERROR', {
              code: 'NO_E2EE_SESSION',
              message: 'Refusing plaintext: no active E2EE session exists for device',
              sessionId: payload.sessionId,
            });
            return;
          }

          let packet: EncryptedPacket;
          try {
            packet = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
            if (
              !packet ||
              typeof packet.ciphertext !== 'string' ||
              typeof packet.nonce !== 'string' ||
              typeof packet.seq !== 'number'
            ) {
              throw new Error('Not an encrypted packet');
            }
          } catch {
            this.sendTerminalEnvelope('TERM_ERROR', {
              code: 'PLAINTEXT_REJECTED',
              message: 'Plaintext input rejected: encrypted payload expected',
              sessionId: payload.sessionId,
            });
            return;
          }

          try {
            inputData = e2eeSession.decrypt(packet);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.sendTerminalEnvelope('TERM_ERROR', {
              code: 'DECRYPTION_FAILED',
              message: `Decryption failed or replay detected: ${msg}`,
              sessionId: payload.sessionId,
            });
            return;
          }
        }

        const dedup = this.inputDeduplicator.processInput(
          payload.inputId,
          payload.generation,
          payload.sessionId
        );

        // Always send TERM_INPUT_ACK back
        this.sendTerminalEnvelope('TERM_INPUT_ACK', dedup.ack);

        if (dedup.isDuplicate) {
          return;
        }

        try {
          this.options.sessionTable.writeInput(payload.sessionId, deviceId, inputData);
        } catch (err) {
          this.sendTerminalEnvelope('TERM_ERROR', {
            code: 'INPUT_REJECTED',
            message: err instanceof Error ? err.message : String(err),
            sessionId: payload.sessionId,
          });
        }
        break;
      }

      case 'TERM_RESIZE': {
        const payload = envelope.payload as TerminalResizePayload;
        const deviceId =
          ((payload as unknown as Record<string, unknown>).deviceId as string) ||
          this.activeDeviceId;

        try {
          this.options.sessionTable.resizeSession(
            payload.sessionId,
            deviceId,
            payload.cols,
            payload.rows
          );
        } catch (err) {
          this.sendTerminalEnvelope('TERM_ERROR', {
            code: 'RESIZE_REJECTED',
            message: err instanceof Error ? err.message : String(err),
            sessionId: payload.sessionId,
          });
        }
        break;
      }

      case 'TERM_DETACH': {
        const payload = envelope.payload as TerminalDetachPayload;
        const deviceId =
          ((payload as unknown as Record<string, unknown>).deviceId as string) ||
          this.activeDeviceId;

        this.options.sessionTable.detachDevice(payload.sessionId, deviceId);
        break;
      }

      case 'TERM_CLOSE_SESSION': {
        const payload = envelope.payload as TerminalCloseSessionPayload;
        await this.options.sessionTable.closeSession(payload.sessionId, 'client_request');
        const sub = this.sessionDisposables.get(payload.sessionId);
        if (sub) {
          sub.dispose();
          this.sessionDisposables.delete(payload.sessionId);
        }
        const sessions = this.options.sessionTable.list();
        this.sendTerminalEnvelope('TERM_SESSIONS_LIST', { sessions });
        break;
      }

      case 'TERM_LIST_SESSIONS': {
        const sessions = this.options.sessionTable.list();
        this.sendTerminalEnvelope('TERM_SESSIONS_LIST', { sessions });
        break;
      }

      case 'TERM_KILL': {
        const payload = envelope.payload as TerminalKillPayload;
        if (payload.all) {
          await this.options.sessionTable.closeAll('remote_kill');
          this.cleanupSessionSubscriptions();
        } else if (payload.sessionId) {
          await this.options.sessionTable.closeSession(payload.sessionId, 'remote_kill');
          const sub = this.sessionDisposables.get(payload.sessionId);
          if (sub) {
            sub.dispose();
            this.sessionDisposables.delete(payload.sessionId);
          }
        }
        break;
      }

      case 'TERM_HANDSHAKE': {
        const payload = envelope.payload as TerminalHandshakePayload;
        this.activeDeviceId = payload.deviceId;
        this.sendTerminalEnvelope('TERM_HANDSHAKE_RESP', {
          accepted: true,
        });
        break;
      }

      case 'TERM_PAIR': {
        const payload = envelope.payload as TerminalPairPayload;
        if (!this.options.pairingManager) {
          this.sendTerminalEnvelope('TERM_PAIR_RESP', {
            success: false,
            attemptId: payload.attemptId,
            error: 'Pairing manager not available',
          });
          break;
        }

        const res = this.options.pairingManager.verifyAndInitiate(
          payload.code,
          payload.clientPublicKey,
          payload.clientDeviceName,
          payload.attemptId,
          this.options.relaySessionId
        );

        if (res.success && res.sessionToken) {
          const sas = this.options.pairingManager.computeSas(res.sessionToken);
          this.sendTerminalEnvelope('TERM_PAIR_RESP', {
            success: true,
            attemptId: payload.attemptId,
            sessionToken: res.sessionToken,
            sas,
            hostPublicKey: sodium.to_base64(this.options.pairingManager.getHostKeyPair().publicKey),
          });
        } else {
          this.sendTerminalEnvelope('TERM_PAIR_RESP', {
            success: false,
            attemptId: payload.attemptId,
            error: res.error || 'Pairing code verification failed',
          });
        }
        break;
      }

      case 'TERM_PAIR_STATUS': {
        const payload = envelope.payload as TerminalPairStatusPayload;
        if (!this.options.pairingManager) {
          this.sendTerminalEnvelope('TERM_PAIR_STATUS_RESP', {
            approved: false,
            attemptId: payload.attemptId,
            sessionToken: payload.sessionToken,
            error: 'Pairing manager not available',
          });
          break;
        }

        const status = this.options.pairingManager.getPairingStatus(
          payload.sessionToken,
          this.options.relaySessionId
        );
        if (status.approved && status.deviceId && status.clientPublicKey && this.hostKeyPair) {
          // Idempotent: Only create E2EESession if not already established to prevent sequence counter reset
          let session = this.e2eeSessions.get(status.deviceId);
          if (!session) {
            try {
              const kxKeys = sodium.crypto_kx_server_session_keys(
                this.hostKeyPair.publicKey,
                this.hostKeyPair.privateKey,
                status.clientPublicKey
              );
              session = new E2EESession('host', kxKeys.sharedTx, kxKeys.sharedRx);
              this.e2eeSessions.set(status.deviceId, session);
              this.activeDeviceId = status.deviceId;
            } catch {
              // ignore
            }
          }
        }

        this.sendTerminalEnvelope('TERM_PAIR_STATUS_RESP', {
          approved: status.approved,
          attemptId: status.attemptId || payload.attemptId,
          sessionToken: status.sessionToken || payload.sessionToken,
          deviceId: status.deviceId,
          hostPublicKey: status.hostPublicKey,
          approvalProof: status.approvalProof,
          error: status.error,
        });
        break;
      }

      default: {
        // Pairing handling for pairing extensions
        if (
          this.options.pairingManager &&
          ((envelope.payload as Record<string, unknown>)?.pairingCode ||
            (envelope.payload as Record<string, unknown>)?.code)
        ) {
          const p = envelope.payload as Record<string, unknown>;
          const code = (p.code || p.pairingCode) as string;
          const pubKey = (p.clientPublicKey || p.publicKey) as string;
          const devName = (p.clientDeviceName || p.deviceName || 'remote-client') as string;

          const res = this.options.pairingManager.verifyAndInitiate(code, pubKey, devName);
          if (res.success && res.sessionToken) {
            const sas = this.options.pairingManager.computeSas(res.sessionToken);
            this.sendTerminalEnvelope('TERM_HANDSHAKE_RESP', {
              accepted: true,
              reason: `SAS:${sas}:${res.sessionToken}`,
            });
          } else {
            this.sendTerminalEnvelope('TERM_HANDSHAKE_RESP', {
              accepted: false,
              reason: res.error,
            });
          }
        }
        break;
      }
    }
  }

  private subscribeSessionOutput(sessionId: string, session: TerminalSession): void {
    if (this.sessionDisposables.has(sessionId)) {
      return;
    }
    const sub = session.pty.onData((data) => {
      this.sendOutput(sessionId, data, session.controllerDeviceId || this.activeDeviceId);
    });
    this.sessionDisposables.set(sessionId, sub);
  }

  private cleanupSessionSubscriptions(): void {
    for (const sub of this.sessionDisposables.values()) {
      try {
        sub.dispose();
      } catch {
        // ignore
      }
    }
    this.sessionDisposables.clear();
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || !this.options.config.isEnabled()) {
      return;
    }

    const maxAttempts = this.options.maxReconnectAttempts ?? Infinity;
    if (this.reconnectAttempt >= maxAttempts) {
      return;
    }

    const initialDelay = this.options.reconnectInitialDelayMs ?? 1000;
    const maxDelay = this.options.reconnectMaxDelayMs ?? 30000;
    const factor = this.options.reconnectBackoffFactor ?? 2;

    const delay = Math.min(initialDelay * Math.pow(factor, this.reconnectAttempt), maxDelay);
    this.reconnectAttempt++;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }
}
