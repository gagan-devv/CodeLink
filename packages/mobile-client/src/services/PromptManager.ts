import type { InjectPromptMessage, InjectPromptResponse } from '@codelink/protocol';
import type { SocketManager } from './SocketManager';

/**
 * Status of a pending prompt
 */
export type PromptStatus = 'pending' | 'success' | 'error';

/**
 * Represents a prompt that has been submitted
 */
export interface PendingPrompt {
  id: string;
  prompt: string;
  timestamp: number;
  status: PromptStatus;
}

/**
 * Callback function for prompt responses
 */
export type ResponseCallback = (response: InjectPromptResponse) => void;

/**
 * PromptManager interface defines the contract for managing prompt submissions
 */
export interface PromptManager {
  // Prompt submission
  submitPrompt(prompt: string): string; // Returns message ID
  
  // Response handling
  handleResponse(response: InjectPromptResponse): void;
  
  // State queries
  getPendingPrompts(): PendingPrompt[];
  getPromptStatus(id: string): PendingPrompt | null;
  
  // Callback registration
  onResponse(callback: ResponseCallback): void;
}

/**
 * PromptManagerImpl manages prompt submission, tracking, and response correlation
 */
export class PromptManagerImpl implements PromptManager {
  private pendingPrompts: Map<string, PendingPrompt> = new Map();
  private socketManager: SocketManager;
  private responseCallbacks: ResponseCallback[] = [];

  constructor(socketManager: SocketManager) {
    this.socketManager = socketManager;
  }

  /**
   * Generates a unique message ID
   * @returns Unique identifier string
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Submits a prompt to the relay server
   * @param prompt - The prompt text to submit
   * @returns The message ID for tracking
   * @throws Error if not connected or prompt is invalid
   */
  submitPrompt(prompt: string): string {
    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    // Check connection
    if (!this.socketManager.isConnected()) {
      throw new Error('Cannot submit prompt: not connected to server');
    }

    // Generate unique message ID
    const messageId = this.generateMessageId();
    const timestamp = Date.now();

    // Create INJECT_PROMPT message conforming to protocol
    const message: InjectPromptMessage = {
      type: 'INJECT_PROMPT',
      id: messageId,
      timestamp,
      payload: {
        prompt: prompt.trim(),
      },
    };

    // Store in pending prompts map
    const pendingPrompt: PendingPrompt = {
      id: messageId,
      prompt: prompt.trim(),
      timestamp,
      status: 'pending',
    };
    this.pendingPrompts.set(messageId, pendingPrompt);

    // Send via socket manager
    try {
      this.socketManager.sendMessage(message);
    } catch (error) {
      // Remove from pending if send fails
      this.pendingPrompts.delete(messageId);
      throw error;
    }

    return messageId;
  }

  /**
   * Handles a response from the relay server
   * @param response - The INJECT_PROMPT_RESPONSE message
   */
  handleResponse(response: InjectPromptResponse): void {
    // Find original prompt using response.originalId
    const originalPrompt = this.pendingPrompts.get(response.originalId);
    
    if (!originalPrompt) {
      console.warn(`Received response for unknown prompt ID: ${response.originalId}`);
      return;
    }

    // Update prompt status
    originalPrompt.status = response.payload.success ? 'success' : 'error';

    // Invoke registered callbacks
    this.responseCallbacks.forEach(callback => {
      try {
        callback(response);
      } catch (error) {
        console.error('Error in response callback:', error);
      }
    });

    // Clean up completed prompt after a delay to allow status queries
    setTimeout(() => {
      this.pendingPrompts.delete(response.originalId);
    }, 5000);
  }

  /**
   * Gets all pending prompts
   * @returns Array of pending prompts
   */
  getPendingPrompts(): PendingPrompt[] {
    return Array.from(this.pendingPrompts.values());
  }

  /**
   * Gets the status of a specific prompt
   * @param id - The message ID to query
   * @returns The prompt status or null if not found
   */
  getPromptStatus(id: string): PendingPrompt | null {
    return this.pendingPrompts.get(id) || null;
  }

  /**
   * Registers a callback for prompt responses
   * @param callback - Function to call when response is received
   */
  onResponse(callback: ResponseCallback): void {
    this.responseCallbacks.push(callback);
  }
}
