import type { SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';
import { isSyncFullContextMessage } from '../utils/messageValidation';

/**
 * DiffState represents the current state of diff data
 */
export interface DiffState {
  currentDiff: FileContextPayload | null;
  history: FileContextPayload[];
  selectedIndex: number;
}

/**
 * DiffMessageHandler manages SYNC_FULL_CONTEXT message handling and diff state
 */
export class DiffMessageHandler {
  private diffState: DiffState = {
    currentDiff: null,
    history: [],
    selectedIndex: -1,
  };
  private stateChangeListeners: Array<(state: DiffState) => void> = [];
  private errorListeners: Array<(error: Error) => void> = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Handles incoming SYNC_FULL_CONTEXT messages
   * @param message - The message to handle
   * @returns true if message was handled successfully, false otherwise
   */
  handleMessage(message: unknown): boolean {
    try {
      // Validate message type
      if (!isSyncFullContextMessage(message)) {
        const error = new Error('Invalid message type: expected SYNC_FULL_CONTEXT');
        this.notifyErrorListeners(error);
        return false;
      }

      // Parse FileContextPayload
      const payload = this.parseFileContextPayload(message);

      // Update diff state
      this.updateDiffState(payload);

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to handle message');
      this.notifyErrorListeners(err);
      return false;
    }
  }

  /**
   * Parses and validates FileContextPayload from message
   * @param message - SYNC_FULL_CONTEXT message
   * @returns Validated FileContextPayload
   * @throws Error if payload is invalid
   */
  private parseFileContextPayload(message: SyncFullContextMessage): FileContextPayload {
    const { payload } = message;

    // Validate required fields
    if (!payload.fileName || typeof payload.fileName !== 'string') {
      throw new Error('Invalid payload: fileName is required and must be a string');
    }

    if (typeof payload.originalFile !== 'string') {
      throw new Error('Invalid payload: originalFile must be a string');
    }

    if (typeof payload.modifiedFile !== 'string') {
      throw new Error('Invalid payload: modifiedFile must be a string');
    }

    if (typeof payload.isDirty !== 'boolean') {
      throw new Error('Invalid payload: isDirty must be a boolean');
    }

    if (typeof payload.timestamp !== 'number') {
      throw new Error('Invalid payload: timestamp must be a number');
    }

    return payload;
  }

  /**
   * Updates diff state with new payload
   * @param payload - FileContextPayload to add to state
   */
  private updateDiffState(payload: FileContextPayload): void {
    // Add to history
    const newHistory = [...this.diffState.history, payload];

    // Trim history if it exceeds max size
    if (newHistory.length > this.maxHistorySize) {
      newHistory.shift();
    }

    // Update state
    this.diffState = {
      currentDiff: payload,
      history: newHistory,
      selectedIndex: newHistory.length - 1,
    };

    // Notify listeners
    this.notifyStateChangeListeners();
  }

  /**
   * Gets the current diff state
   * @returns Current DiffState
   */
  getDiffState(): DiffState {
    return { ...this.diffState };
  }

  /**
   * Gets the current diff payload
   * @returns Current FileContextPayload or null
   */
  getCurrentDiff(): FileContextPayload | null {
    return this.diffState.currentDiff;
  }

  /**
   * Gets diff history
   * @returns Array of FileContextPayload
   */
  getHistory(): FileContextPayload[] {
    return [...this.diffState.history];
  }

  /**
   * Selects a diff from history by index
   * @param index - Index in history array
   * @returns true if selection was successful, false otherwise
   */
  selectDiffByIndex(index: number): boolean {
    if (index < 0 || index >= this.diffState.history.length) {
      return false;
    }

    this.diffState = {
      ...this.diffState,
      currentDiff: this.diffState.history[index],
      selectedIndex: index,
    };

    this.notifyStateChangeListeners();
    return true;
  }

  /**
   * Clears diff history
   */
  clearHistory(): void {
    this.diffState = {
      currentDiff: null,
      history: [],
      selectedIndex: -1,
    };

    this.notifyStateChangeListeners();
  }

  /**
   * Registers a listener for state changes
   * @param listener - Function to call when state changes
   */
  onStateChange(listener: (state: DiffState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Registers a listener for errors
   * @param listener - Function to call when error occurs
   */
  onError(listener: (error: Error) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Notifies all state change listeners
   */
  private notifyStateChangeListeners(): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(this.getDiffState());
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Notifies all error listeners
   */
  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }
}
