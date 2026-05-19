import { patchEngine }       from '../diff/PatchEngine';
import { useDiffStore }      from '../store/useDiffStore';
import { useSessionStore }   from '../store/useSessionStore';
import { usePromptStore }    from '../store/usePromptStore';
import { clearStoredSession } from '../api/authClient';
import { wsManager }         from './WsManager';

export function handleMessage(type: string, payload: unknown, id: string): void {
  switch (type) {

    case 'HANDSHAKE_ACK': {
      useSessionStore.getState().setConnected(id);
      break;
    }

    case 'FILE_SNAPSHOT': {
      const p = payload as {
        fileName: string; content: string;
        encoding: 'utf8' | 'gzip+base64';
        seq: number; isDirty: boolean;
      };
      const content = p.encoding === 'utf8'
        ? p.content
        : decodeGzip(p.content);

      patchEngine.applySnapshot(p.fileName, content, p.seq);
      useDiffStore.getState().setFile(p.fileName, content, p.isDirty, p.seq);
      wsManager.send('PATCH_ACK', { fileName: p.fileName, seq: p.seq });
      break;
    }

    case 'FILE_PATCH': {
      const p = payload as {
        fileName: string; patches: string;
        fromSeq: number; toSeq: number; isDirty: boolean;
      };
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
        originalId: string; success: boolean;
        editorUsed?: string; error?: string;
      };
      usePromptStore.getState().resolvePrompt(p.originalId, p.success, p.editorUsed, p.error);
      break;
    }

    case 'SESSION_REVOKED': {
      wsManager.disconnect();
      clearStoredSession();
      patchEngine.clearAll();
      useDiffStore.getState().clear();
      usePromptStore.getState().clear();
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