import { describe, it, expect } from 'vitest';
import {
  PingMessage,
  PongMessage,
  ProtocolMessage,
  MessageType,
  FileContextPayload,
  SyncFullContextMessage,
} from './index';

describe('Protocol Types', () => {
  describe('PingMessage', () => {
    it('should create a valid PingMessage with extension source', () => {
      const ping: PingMessage = {
        id: 'test-id-123',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      expect(ping.id).toBe('test-id-123');
      expect(ping.type).toBe('ping');
      expect(ping.source).toBe('extension');
      expect(typeof ping.timestamp).toBe('number');
    });

    it('should create a valid PingMessage with mobile source', () => {
      const ping: PingMessage = {
        id: 'test-id-456',
        timestamp: Date.now(),
        type: 'ping',
        source: 'mobile',
      };

      expect(ping.id).toBe('test-id-456');
      expect(ping.type).toBe('ping');
      expect(ping.source).toBe('mobile');
      expect(typeof ping.timestamp).toBe('number');
    });
  });

  describe('PongMessage', () => {
    it('should create a valid PongMessage with originalId', () => {
      const pong: PongMessage = {
        id: 'pong-id-789',
        timestamp: Date.now(),
        type: 'pong',
        originalId: 'original-ping-id',
      };

      expect(pong.id).toBe('pong-id-789');
      expect(pong.type).toBe('pong');
      expect(pong.originalId).toBe('original-ping-id');
      expect(typeof pong.timestamp).toBe('number');
    });
  });

  describe('ProtocolMessage union type', () => {
    it('should discriminate PingMessage type', () => {
      const message: ProtocolMessage = {
        id: 'test-id',
        timestamp: Date.now(),
        type: 'ping',
        source: 'extension',
      };

      if (message.type === 'ping') {
        expect(message.source).toBeDefined();
        expect(['extension', 'mobile']).toContain(message.source);
      }
    });

    it('should discriminate PongMessage type', () => {
      const message: ProtocolMessage = {
        id: 'test-id',
        timestamp: Date.now(),
        type: 'pong',
        originalId: 'original-id',
      };

      if (message.type === 'pong') {
        expect(message.originalId).toBeDefined();
        expect(message.originalId).toBe('original-id');
      }
    });
  });

  describe('MessageType enum', () => {
    it('should contain SYNC_FULL_CONTEXT type', () => {
      expect(MessageType.SYNC_FULL_CONTEXT).toBe('SYNC_FULL_CONTEXT');
    });

    it('should contain PING type', () => {
      expect(MessageType.PING).toBe('PING');
    });

    it('should contain PONG type', () => {
      expect(MessageType.PONG).toBe('PONG');
    });
  });

  describe('FileContextPayload', () => {
    it('should create a valid FileContextPayload with all required fields', () => {
      const payload: FileContextPayload = {
        fileName: 'src/index.ts',
        originalFile: 'const x = 1;',
        modifiedFile: 'const x = 2;',
        isDirty: true,
        timestamp: Date.now(),
      };

      expect(payload.fileName).toBe('src/index.ts');
      expect(payload.originalFile).toBe('const x = 1;');
      expect(payload.modifiedFile).toBe('const x = 2;');
      expect(payload.isDirty).toBe(true);
      expect(typeof payload.timestamp).toBe('number');
    });

    it('should handle empty originalFile for untracked files', () => {
      const payload: FileContextPayload = {
        fileName: 'src/newfile.ts',
        originalFile: '',
        modifiedFile: 'const newCode = true;',
        isDirty: false,
        timestamp: Date.now(),
      };

      expect(payload.originalFile).toBe('');
      expect(payload.modifiedFile).toBe('const newCode = true;');
    });

    it('should handle identical files with isDirty false', () => {
      const content = 'const unchanged = true;';
      const payload: FileContextPayload = {
        fileName: 'src/unchanged.ts',
        originalFile: content,
        modifiedFile: content,
        isDirty: false,
        timestamp: Date.now(),
      };

      expect(payload.originalFile).toBe(payload.modifiedFile);
      expect(payload.isDirty).toBe(false);
    });
  });

  describe('SyncFullContextMessage', () => {
    it('should create a valid SyncFullContextMessage structure', () => {
      const message: SyncFullContextMessage = {
        id: 'sync-msg-123',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'src/app.ts',
          originalFile: 'old content',
          modifiedFile: 'new content',
          isDirty: true,
          timestamp: Date.now(),
        },
      };

      expect(message.id).toBe('sync-msg-123');
      expect(message.type).toBe('SYNC_FULL_CONTEXT');
      expect(message.payload.fileName).toBe('src/app.ts');
      expect(message.payload.originalFile).toBe('old content');
      expect(message.payload.modifiedFile).toBe('new content');
      expect(message.payload.isDirty).toBe(true);
      expect(typeof message.timestamp).toBe('number');
      expect(typeof message.payload.timestamp).toBe('number');
    });
  });

  describe('ProtocolMessage union type with SyncFullContextMessage', () => {
    it('should discriminate SyncFullContextMessage type', () => {
      const message: ProtocolMessage = {
        id: 'test-sync-id',
        timestamp: Date.now(),
        type: 'SYNC_FULL_CONTEXT',
        payload: {
          fileName: 'test.ts',
          originalFile: 'original',
          modifiedFile: 'modified',
          isDirty: false,
          timestamp: Date.now(),
        },
      };

      if (message.type === 'SYNC_FULL_CONTEXT') {
        expect(message.payload).toBeDefined();
        expect(message.payload.fileName).toBe('test.ts');
        expect(message.payload.originalFile).toBe('original');
        expect(message.payload.modifiedFile).toBe('modified');
      }
    });
  });
});
