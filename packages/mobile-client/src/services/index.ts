// Service layer exports
// This file will export all service implementations

export { SocketManager, SocketManagerImpl } from './SocketManager';
export { DiffMessageHandler, type DiffState } from './DiffMessageHandler';
export { 
  PromptManager, 
  PromptManagerImpl, 
  type PendingPrompt, 
  type PromptStatus,
  type ResponseCallback 
} from './PromptManager';
