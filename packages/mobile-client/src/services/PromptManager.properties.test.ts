import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { PromptManagerImpl } from './PromptManager';
import type { SocketManager } from './SocketManager';
import type { InjectPromptMessage } from '@codelink/protocol';

describe('PromptManager - Property-Based Tests', () => {
  let mockSocketManager: SocketManager;
  let sentMessages: InjectPromptMessage[];

  beforeEach(() => {
    sentMessages = [];
    
    mockSocketManager = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      sendMessage: vi.fn((message) => {
        sentMessages.push(message as InjectPromptMessage);
      }),
      onMessage: vi.fn(),
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onError: vi.fn(),
    };
  });

  // Feature: mobile-client-expo-migration, Property 3: Message Structure Conformance
  // **Validates: Requirements 1.3, 11.2**
  it('Property 3: all INJECT_PROMPT messages conform to protocol structure', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length > 0),
        (prompt) => {
          const manager = new PromptManagerImpl(mockSocketManager);
          sentMessages = [];
          
          // Submit prompt
          const messageId = manager.submitPrompt(prompt);
          
          // Verify message was sent
          expect(sentMessages).toHaveLength(1);
          const message = sentMessages[0];
          
          // Verify message structure conformance
          expect(message).toBeDefined();
          expect(message.type).toBe('INJECT_PROMPT');
          expect(message.id).toBe(messageId);
          expect(typeof message.id).toBe('string');
          expect(message.id.length).toBeGreaterThan(0);
          expect(typeof message.timestamp).toBe('number');
          expect(message.timestamp).toBeGreaterThan(0);
          expect(message.payload).toBeDefined();
          expect(message.payload.prompt).toBe(prompt.trim());
          expect(typeof message.payload.prompt).toBe('string');
          
          // Verify all required fields are present
          const requiredFields = ['type', 'id', 'timestamp', 'payload'];
          requiredFields.forEach(field => {
            expect(message).toHaveProperty(field);
          });
          
          // Verify payload has prompt field
          expect(message.payload).toHaveProperty('prompt');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: mobile-client-expo-migration, Property 7: Message ID Storage for Correlation
  // **Validates: Requirements 2.4**
  it('Property 7: message IDs are stored for response correlation', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 20 }
        ),
        (prompts) => {
          const manager = new PromptManagerImpl(mockSocketManager);
          const messageIds: string[] = [];
          
          // Submit all prompts and collect message IDs
          prompts.forEach(prompt => {
            const messageId = manager.submitPrompt(prompt);
            messageIds.push(messageId);
          });
          
          // Verify all message IDs are stored in pending prompts
          messageIds.forEach(messageId => {
            const status = manager.getPromptStatus(messageId);
            expect(status).not.toBeNull();
            expect(status?.id).toBe(messageId);
            expect(status?.status).toBe('pending');
          });
          
          // Verify getPendingPrompts returns all prompts
          const pendingPrompts = manager.getPendingPrompts();
          expect(pendingPrompts).toHaveLength(prompts.length);
          
          // Verify all message IDs are in the pending prompts list
          const pendingIds = pendingPrompts.map(p => p.id);
          messageIds.forEach(id => {
            expect(pendingIds).toContain(id);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: mobile-client-expo-migration, Property 8: Response Correlation
  // **Validates: Requirements 3.1, 3.5**
  it('Property 8: responses correlate with original messages even with multiple prompts in flight', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            prompt: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
            success: fc.boolean(),
            editorUsed: fc.constantFrom('Continue', 'Kiro', 'Cursor', 'Antigravity'),
            error: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (promptConfigs) => {
          const manager = new PromptManagerImpl(mockSocketManager);
          const messageIds: string[] = [];
          
          // Submit all prompts
          promptConfigs.forEach(config => {
            const messageId = manager.submitPrompt(config.prompt);
            messageIds.push(messageId);
          });
          
          // Create responses in shuffled order to simulate out-of-order arrival
          const responses = promptConfigs.map((config, index) => ({
            type: 'INJECT_PROMPT_RESPONSE' as const,
            id: `response-${Date.now()}-${index}`,
            timestamp: Date.now(),
            originalId: messageIds[index],
            payload: {
              success: config.success,
              editorUsed: config.success ? config.editorUsed : undefined,
              error: !config.success ? (config.error || 'Unknown error') : undefined
            }
          }));
          
          // Shuffle responses to simulate out-of-order arrival
          const shuffled = [...responses].sort(() => Math.random() - 0.5);
          
          // Handle each response
          shuffled.forEach(response => {
            manager.handleResponse(response);
          });
          
          // Verify all prompts were correlated correctly
          messageIds.forEach((id, index) => {
            const status = manager.getPromptStatus(id);
            expect(status).not.toBeNull();
            
            // Verify status was updated based on response
            const expectedStatus = promptConfigs[index].success ? 'success' : 'error';
            expect(status?.status).toBe(expectedStatus);
            
            // Verify original prompt data is preserved
            expect(status?.id).toBe(id);
            expect(status?.prompt).toBe(promptConfigs[index].prompt.trim());
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
