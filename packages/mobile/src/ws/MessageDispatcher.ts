import { patchEngine } from '../diff/PatchEngine';
import { useDiffStore } from '../store/useDiffStore';
import { useSessionStore } from '../store/useSessionStore';
import { usePromptStore } from '../store/usePromptStore';
import { useTerminalStore } from '../terminal/useTerminalStore';
import { clearStoredSession } from '../api/authClient';
import { wsManager } from './WsManager';
import {
  isFileSnapshotPayload,
  isFilePatchPayload,
  TerminalPairRespPayload,
  TerminalPairStatusRespPayload,
} from '@codelink/protocol';
import { MobilePairingService } from '../crypto/MobilePairingService';
import { computeEpoch } from '../crypto/nobleKx';

export function handleMessage(type: string, payload: unknown, id: string): void {
  console.log(`[MessageDispatcher] Received message: type=${type}`);
  switch (type) {
    case 'HANDSHAKE_ACK': {
      useSessionStore.getState().setConnected(id);
      break;
    }

    case 'FILE_SNAPSHOT': {
      if (!isFileSnapshotPayload(payload)) {
        return;
      }
      const p = payload;
      const content = p.encoding === 'utf8' ? p.content : decodeGzip(p.content);

      patchEngine.applySnapshot(p.fileName, content, p.seq);
      useDiffStore.getState().setFile(p.fileName, content, p.isDirty, p.seq);
      wsManager.send('PATCH_ACK', { fileName: p.fileName, seq: p.seq });
      break;
    }

    case 'FILE_PATCH': {
      if (!isFilePatchPayload(payload)) {
        return;
      }
      const p = payload;
      const result = patchEngine.applyPatch(p.fileName, p.patches, p.fromSeq, p.toSeq);

      if ('gap' in result) {
        wsManager.send('SNAPSHOT_REQUEST', { fileName: p.fileName, reason: 'gap' });
        return;
      }
      if (!result.success) {
        wsManager.send('SNAPSHOT_REQUEST', { fileName: p.fileName, reason: 'corruption' });
        return;
      }
      useDiffStore.getState().setFile(p.fileName, result.content, p.isDirty, p.toSeq);
      wsManager.send('PATCH_ACK', { fileName: p.fileName, seq: p.toSeq });
      break;
    }

    case 'EDITOR_FOCUS': {
      const p = payload as { cursorLine: number; cursorCol: number };
      useDiffStore.getState().setCursor(p.cursorLine, p.cursorCol);
      break;
    }

    case 'PROMPT_RESPONSE': {
      const p = payload as {
        originalId: string;
        success: boolean;
        editorUsed?: string;
        error?: string;
      };
      usePromptStore.getState().resolvePrompt(p.originalId, p.success, p.editorUsed, p.error);
      break;
    }

    case 'TERM_OUTPUT': {
      const p = payload as { sessionId: string; data: string };
      if (p && typeof p.sessionId === 'string' && typeof p.data === 'string') {
        const { e2eeSession } = useTerminalStore.getState();
        if (e2eeSession) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(p.data);
          } catch {
            useTerminalStore
              .getState()
              .setE2EEError('Plaintext terminal output rejected: active E2EE session exists');
            return;
          }

          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'ciphertext' in parsed &&
            'nonce' in parsed &&
            'seq' in parsed &&
            typeof (parsed as { ciphertext: unknown }).ciphertext === 'string' &&
            typeof (parsed as { nonce: unknown }).nonce === 'string' &&
            typeof (parsed as { seq: unknown }).seq === 'number'
          ) {
            try {
              const decrypted = e2eeSession.decrypt(
                parsed as { seq: number; nonce: string; ciphertext: string }
              );
              useTerminalStore.getState().appendOutput(p.sessionId, decrypted);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              useTerminalStore.getState().setE2EEError(`Failed to decrypt terminal output: ${msg}`);
            }
          } else {
            useTerminalStore
              .getState()
              .setE2EEError('Plaintext terminal output rejected: active E2EE session exists');
          }
        } else {
          try {
            const parsed = JSON.parse(p.data);
            if (parsed && parsed.ciphertext && parsed.nonce) {
              useTerminalStore
                .getState()
                .setE2EEError('Encrypted terminal output received but device is unpaired');
              return;
            }
          } catch {
            // Not JSON, plaintext output
          }
          useTerminalStore.getState().appendOutput(p.sessionId, p.data);
        }
      }
      break;
    }

    case 'TERM_PAIR_RESP': {
      MobilePairingService.handlePairResp(payload as TerminalPairRespPayload).catch((err) => {
        console.error('[MessageDispatcher] Error handling TERM_PAIR_RESP:', err);
        const msg = err instanceof Error ? err.message : String(err);
        useTerminalStore.getState().setE2EEError(`Pairing response error: ${msg}`);
      });
      break;
    }

    case 'TERM_PAIR_STATUS_RESP': {
      MobilePairingService.handlePairStatus(payload as TerminalPairStatusRespPayload).catch(
        (err) => {
          console.error('[MessageDispatcher] Error handling TERM_PAIR_STATUS_RESP:', err);
          const msg = err instanceof Error ? err.message : String(err);
          useTerminalStore.getState().setE2EEError(`Pairing status error: ${msg}`);
        }
      );
      break;
    }

    case 'TERM_ERROR': {
      const p = payload as { code?: string; message?: string; error?: string };
      const code = p?.code || 'TERM_ERROR';
      const msg = p?.message || p?.error || 'Unknown error';

      // Route pairing and authorization errors
      if (
        code === 'COMPANION_NOT_CONNECTED' ||
        code === 'DEVICE_NOT_APPROVED' ||
        code === 'PAIRING_REVOKED' ||
        code === 'NO_ACTIVE_CHALLENGE' ||
        code === 'INVALID_PAIRING_CODE' ||
        code === 'PAIRING_EXPIRED' ||
        code === 'PAIRING_ATTEMPTS_EXCEEDED'
      ) {
        MobilePairingService.handleTermError(code, msg);
        break;
      }

      // If already paired, ordinary terminal session errors (e.g. INPUT_REJECTED, RESIZE_REJECTED)
      // must not wipe or disrupt the E2EE paired state
      const { e2eeState } = useTerminalStore.getState();
      if (e2eeState === 'paired') {
        console.warn(`[MessageDispatcher] Routine terminal session error: [${code}] ${msg}`);
        break;
      }

      // If initiating or pending, route to pairing handler
      MobilePairingService.handleTermError(code, msg);
      break;
    }

    case 'TERM_GAP': {
      const p = payload as { sessionId?: string };
      useTerminalStore.getState().setGapNotice(true);
      if (p && p.sessionId) {
        useTerminalStore.getState().incrementGeneration(p.sessionId);
      }
      break;
    }

    case 'TERM_ATTACH_RESP': {
      const p = payload as {
        sessionId: string;
        mode: 'observe' | 'control';
        hasGap: boolean;
        hostNonce?: string;
        epoch?: string;
      };
      if (p && (p.mode === 'observe' || p.mode === 'control')) {
        useTerminalStore.getState().setMode(p.mode);
        if (p.hasGap) {
          useTerminalStore.getState().setGapNotice(true);
        }
      }

      if (p && p.hostNonce && MobilePairingService.getPendingAttachClientNonce()) {
        const clientNonce = MobilePairingService.getPendingAttachClientNonce()!;
        const epoch = computeEpoch(clientNonce, p.hostNonce);
        const { e2eeSession } = useTerminalStore.getState();
        if (e2eeSession) {
          e2eeSession.setEpoch(epoch);
        }
        MobilePairingService.clearPendingAttachClientNonce();
      }
      break;
    }

    case 'TERM_MODE_CHANGE': {
      const p = payload as { sessionId: string; mode: 'observe' | 'control' };
      if (p && (p.mode === 'observe' || p.mode === 'control')) {
        useTerminalStore.getState().setMode(p.mode);
      }
      break;
    }

    case 'TERM_SESSIONS_LIST': {
      const p = payload as {
        sessions: Array<{
          id: string;
          title: string;
          controllerDeviceId: string | null;
          observerCount: number;
          active: boolean;
        }>;
      };
      if (p && Array.isArray(p.sessions)) {
        useTerminalStore.getState().setSessions(p.sessions);
      }
      break;
    }

    case 'SESSION_REVOKED': {
      wsManager.disconnect();
      clearStoredSession();
      patchEngine.clearAll();
      useDiffStore.getState().clear();
      usePromptStore.getState().clear();
      useTerminalStore.getState().reset();
      useSessionStore.getState().setRevoked();
      break;
    }
  }
}

// Minimal gzip+base64 decoder using React Native's atob + pako (add pako if needed)
// For MVP: files under 64KB are sent uncompressed, so this path is rarely hit.
function decodeGzip(b64: string): string {
  try {
    // Fallback: return base64 string if decompression isn't available.
    // TODO: add `pako` package and implement full gzip decompression.
    return atob(b64);
  } catch {
    return '';
  }
}
