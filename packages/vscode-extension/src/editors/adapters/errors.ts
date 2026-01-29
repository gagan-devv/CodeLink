import * as vscode from 'vscode';
import { IEditorAdapter, PromptInjectionResult } from './types';

/**
 * Error types for editor adapter operations.
 */
export enum EditorAdapterErrorType {
  /** Command execution failed */
  COMMAND_EXECUTION_FAILED = 'COMMAND_EXECUTION_FAILED',
  /** Editor not installed or not detected */
  EDITOR_NOT_FOUND = 'EDITOR_NOT_FOUND',
  /** Operation not supported by this editor */
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  /** Capability check failed */
  CAPABILITY_CHECK_FAILED = 'CAPABILITY_CHECK_FAILED',
  /** Unknown or unexpected error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error result for adapter operations.
 */
export interface EditorAdapterError {
  /** Whether the operation succeeded */
  success: false;
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code */
  errorCode: EditorAdapterErrorType;
  /** Additional context for debugging */
  details?: any;
}

/**
 * Safe command execution wrapper that catches exceptions and returns error results.
 * 
 * Safety: Never throws exceptions. Always returns a PromptInjectionResult with
 * clear error messages if the command fails.
 * 
 * @param command - VS Code command to execute
 * @param args - Arguments to pass to the command
 * @returns PromptInjectionResult indicating success or failure
 */
export async function safeExecuteCommand(
  command: string,
  ...args: any[]
): Promise<PromptInjectionResult> {
  try {
    await vscode.commands.executeCommand(command, ...args);
    return {
      success: true,
      commandUsed: command,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Command '${command}' failed: ${errorMessage}`,
      commandUsed: command,
    };
  }
}

/**
 * Check if an adapter has a specific capability before attempting an operation.
 * 
 * Safety: Prevents invalid operations by checking capabilities first.
 * Throws a clear error if the capability is not supported.
 * 
 * @param adapter - The editor adapter to check
 * @param capability - The capability key to check
 * @param operationName - Human-readable name of the operation (for error messages)
 * @throws Error if the capability is not supported
 */
export function requireCapability(
  adapter: IEditorAdapter,
  capability: keyof IEditorAdapter['capabilities'],
  operationName: string
): void {
  const hasCapability = adapter.capabilities[capability];
  
  if (!hasCapability) {
    throw new Error(
      `Editor ${adapter.editorName} does not support ${operationName}. ` +
      `Capability '${capability}' is not available. ` +
      `Sync level: ${adapter.capabilities.syncLevel}`
    );
  }
}

/**
 * Check if an adapter has implemented an optional method.
 * 
 * Safety: Ensures that adapters claiming a capability actually implement
 * the corresponding method.
 * 
 * @param adapter - The editor adapter to check
 * @param methodName - The method name to check
 * @param capability - The capability that should enable this method
 * @throws Error if the method is not implemented despite capability being true
 */
export function requireMethod(
  adapter: IEditorAdapter,
  methodName: keyof IEditorAdapter,
  capability: keyof IEditorAdapter['capabilities']
): void {
  const method = adapter[methodName];
  
  if (!method || typeof method !== 'function') {
    throw new Error(
      `Editor ${adapter.editorName} claims to support '${String(capability)}' ` +
      `but does not implement ${String(methodName)}() method`
    );
  }
}

/**
 * Format an error message with context about the adapter and operation.
 * 
 * @param adapter - The editor adapter that encountered the error
 * @param operation - The operation that failed
 * @param error - The error that occurred
 * @returns Formatted error message with full context
 */
export function formatAdapterError(
  adapter: IEditorAdapter,
  operation: string,
  error: unknown
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return (
    `Failed to ${operation} for editor ${adapter.editorName} (${adapter.editorId}): ` +
    `${errorMessage}`
  );
}

/**
 * Create a structured error result for adapter operations.
 * 
 * @param errorType - The type of error that occurred
 * @param message - Human-readable error message
 * @param details - Optional additional context
 * @returns Structured error result
 */
export function createAdapterError(
  errorType: EditorAdapterErrorType,
  message: string,
  details?: any
): EditorAdapterError {
  return {
    success: false,
    error: message,
    errorCode: errorType,
    details,
  };
}

/**
 * Safely execute an operation that requires a specific capability.
 * 
 * This combines capability checking with safe execution and error formatting.
 * 
 * @param adapter - The editor adapter to use
 * @param capability - The required capability
 * @param operationName - Human-readable operation name
 * @param operation - The async operation to execute
 * @returns Result of the operation or an error
 */
export async function executeWithCapabilityCheck<T>(
  adapter: IEditorAdapter,
  capability: keyof IEditorAdapter['capabilities'],
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    requireCapability(adapter, capability, operationName);
    return await operation();
  } catch (error) {
    throw new Error(formatAdapterError(adapter, operationName, error));
  }
}
