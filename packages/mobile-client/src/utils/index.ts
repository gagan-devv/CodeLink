// Utility functions for the mobile client
// This file will contain helper functions and utilities

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Export message validation utilities
export {
  isInjectPromptMessage,
  isInjectPromptResponse,
  isSyncFullContextMessage,
  validateProtocolMessage,
  discriminateMessageType,
} from './messageValidation';
